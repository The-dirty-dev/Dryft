import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { authRateLimit, passwordRateLimit } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';

const router = Router();

// =============================================================================
// Schemas
// =============================================================================

// Password complexity requirements:
// - Minimum 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one number
// - At least one special character
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  displayName: z.string().min(2).max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: passwordSchema,
});

// =============================================================================
// Helpers
// =============================================================================

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );

  const refreshToken = uuid();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  return { accessToken, refreshToken, expiresAt };
}

function getExpiresIn(expiry: string): number {
  const match = expiry.match(/(\d+)([smhd])/);
  if (!match) return 900; // Default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 900;
  }
}

// =============================================================================
// Routes
// =============================================================================

// Register
router.post('/register', authRateLimit, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new AppError(409, 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        displayName: data.displayName,
      },
    });

    // Create default preferences
    await prisma.preferences.create({
      data: { userId: user.id },
    });

    // Generate tokens
    const { accessToken, refreshToken, expiresAt } = generateTokens(user.id, user.email);

    // Save session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        verified: user.verified,
        created_at: user.createdAt,
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: getExpiresIn(config.jwt.accessExpiry),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', authRateLimit, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || user.deletedAt) {
      throw new AppError(401, 'Invalid email or password');
    }

    // Verify password
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken, expiresAt } = generateTokens(user.id, user.email);

    // Save session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date(), isOnline: true },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        bio: user.bio,
        profile_photo: user.profilePhoto,
        verified: user.verified,
        verified_at: user.verifiedAt,
        created_at: user.createdAt,
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: getExpiresIn(config.jwt.accessExpiry),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const data = refreshSchema.parse(req.body);

    // Find session
    const session = await prisma.session.findUnique({
      where: { refreshToken: data.refresh_token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    // SEC-007: Validate IP address matches session (prevent session fixation)
    const currentIp = req.ip;
    if (session.ipAddress && session.ipAddress !== currentIp) {
      // Log suspicious activity
      logger.warn('Session refresh from different IP', {
        userId: session.userId,
        sessionId: session.id,
        originalIp: session.ipAddress,
        currentIp,
      });

      // Invalidate the session for security
      await prisma.session.delete({ where: { id: session.id } });
      throw new AppError(401, 'Session invalidated due to IP change. Please log in again.');
    }

    // Generate new tokens
    const { accessToken, refreshToken, expiresAt } = generateTokens(
      session.user.id,
      session.user.email
    );

    // Update session with new refresh token and current device info
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken,
        expiresAt,
        deviceInfo: req.headers['user-agent'],
        ipAddress: currentIp,
      },
    });

    res.json({
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: getExpiresIn(config.jwt.accessExpiry),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const refreshToken = req.body.refresh_token;

    if (refreshToken) {
      // Delete specific session
      await prisma.session.deleteMany({
        where: {
          userId: req.user!.id,
          refreshToken,
        },
      });
    }

    // Update user status
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { isOnline: false },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Logout all devices
router.post('/logout-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Delete all sessions
    await prisma.session.deleteMany({
      where: { userId: req.user!.id },
    });

    // Update user status
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { isOnline: false },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', passwordRateLimit, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Verify current password
    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(data.newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all other sessions
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        profile: true,
        preferences: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      bio: user.bio,
      profile_photo: user.profilePhoto,
      photos: user.photos,
      interests: user.interests,
      verified: user.verified,
      verified_at: user.verifiedAt,
      subscription_tier: user.subscriptionTier,
      is_creator: user.isCreator,
      created_at: user.createdAt,
      profile: user.profile,
      preferences: user.preferences,
    });
  } catch (error) {
    next(error);
  }
});

// Get active sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

// Revoke session
router.delete('/sessions/:sessionId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.session.deleteMany({
      where: {
        id: req.params.sessionId,
        userId: req.user!.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

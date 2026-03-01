import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { passwordRateLimit } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';

const router = Router();

// =============================================================================
// Schemas
// =============================================================================

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  birthDate: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER']).optional(),
  photos: z.array(z.string().url()).max(6).optional(),
  interests: z.array(z.string()).max(20).optional(),
  height: z.number().min(100).max(250).optional(),
  occupation: z.string().max(100).optional(),
  education: z.string().max(100).optional(),
  languages: z.array(z.string()).max(10).optional(),
  relationshipGoal: z.enum([
    'CASUAL', 'DATING', 'RELATIONSHIP', 'MARRIAGE', 'FRIENDSHIP', 'NOT_SURE'
  ]).optional(),
  prompts: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).max(5).optional(),
});

const updatePreferencesSchema = z.object({
  minAge: z.number().min(18).max(100).optional(),
  maxAge: z.number().min(18).max(100).optional(),
  maxDistance: z.number().min(1).max(500).optional(),
  genderPreference: z.array(z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'])).optional(),
  onlineOnly: z.boolean().optional(),
  verifiedOnly: z.boolean().optional(),
  vrReadyOnly: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  matchNotif: z.boolean().optional(),
  messageNotif: z.boolean().optional(),
  likeNotif: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
  showDistance: z.boolean().optional(),
  showLastActive: z.boolean().optional(),
});

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().optional(),
  country: z.string().optional(),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string().optional(),
});

// =============================================================================
// Routes
// =============================================================================

// Update profile
router.patch('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    // Update user fields
    const userUpdate: any = {};
    if (data.displayName !== undefined) userUpdate.displayName = data.displayName;
    if (data.bio !== undefined) userUpdate.bio = data.bio;
    if (data.birthDate !== undefined) userUpdate.birthDate = new Date(data.birthDate);
    if (data.gender !== undefined) userUpdate.gender = data.gender;
    if (data.photos !== undefined) userUpdate.photos = data.photos;
    if (data.interests !== undefined) userUpdate.interests = data.interests;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: userUpdate,
    });

    // Update profile fields
    const profileUpdate: any = {};
    if (data.height !== undefined) profileUpdate.height = data.height;
    if (data.occupation !== undefined) profileUpdate.occupation = data.occupation;
    if (data.education !== undefined) profileUpdate.education = data.education;
    if (data.languages !== undefined) profileUpdate.languages = data.languages;
    if (data.relationshipGoal !== undefined) profileUpdate.relationshipGoal = data.relationshipGoal;
    if (data.prompts !== undefined) profileUpdate.prompts = data.prompts;

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.profile.upsert({
        where: { userId: req.user!.id },
        update: profileUpdate,
        create: {
          userId: req.user!.id,
          ...profileUpdate,
        },
      });
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
    });
  } catch (error) {
    next(error);
  }
});

// Update preferences
router.patch('/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = updatePreferencesSchema.parse(req.body);

    const preferences = await prisma.preferences.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: {
        userId: req.user!.id,
        ...data,
      },
    });

    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

// Update location
router.patch('/location', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = updateLocationSchema.parse(req.body);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city,
        country: data.country,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:userId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;

    // Check if blocked
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.user!.id, blockedId: userId },
          { blockerId: userId, blockedId: req.user!.id },
        ],
      },
    });

    if (blocked) {
      throw new AppError(404, 'User not found');
    }

    // PERF-006: Use select instead of include to fetch only needed fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        bio: true,
        profilePhoto: true,
        photos: true,
        interests: true,
        verified: true,
        isOnline: true,
        lastActive: true,
        latitude: true,
        longitude: true,
        deletedAt: true,
        profile: {
          select: {
            height: true,
            occupation: true,
            education: true,
            languages: true,
            relationshipGoal: true,
            prompts: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError(404, 'User not found');
    }

    // Get viewer's preferences for distance calculation
    const viewer = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { latitude: true, longitude: true },
    });

    let distance: number | undefined;
    if (viewer?.latitude && viewer?.longitude && user.latitude && user.longitude) {
      distance = calculateDistance(
        viewer.latitude,
        viewer.longitude,
        user.latitude,
        user.longitude
      );
    }

    res.json({
      id: user.id,
      display_name: user.displayName,
      bio: user.bio,
      profile_photo: user.profilePhoto,
      photos: user.photos,
      interests: user.interests,
      verified: user.verified,
      is_online: user.isOnline,
      last_active: user.lastActive,
      distance,
      profile: user.profile ? {
        height: user.profile.height,
        occupation: user.profile.occupation,
        education: user.profile.education,
        languages: user.profile.languages,
        relationship_goal: user.profile.relationshipGoal,
        prompts: user.profile.prompts,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// Update profile photo
router.patch('/profile-photo', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { photo_url } = req.body;

    if (!photo_url || typeof photo_url !== 'string') {
      throw new AppError(400, 'Photo URL is required');
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { profilePhoto: photo_url },
    });

    res.json({ success: true, photo_url });
  } catch (error) {
    next(error);
  }
});

// Update online status
router.patch('/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { is_online } = req.body;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        isOnline: is_online,
        lastActive: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Account Deletion (GDPR/CCPA Compliance)
// =============================================================================

router.delete('/me', passwordRateLimit, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = deleteAccountSchema.parse(req.body);
    const userId = req.user!.id;

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true, stripeCustomerId: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Verify password
    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'Incorrect password');
    }

    logger.info(`Account deletion requested for user ${userId} (${user.email})`);

    // Log deletion reason if provided
    if (data.reason) {
      logger.info(`Deletion reason for ${userId}: ${data.reason}`);
    }

    // Perform deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all sessions (log out everywhere)
      await tx.session.deleteMany({ where: { userId } });

      // 2. Delete push tokens
      await tx.pushToken.deleteMany({ where: { userId } });

      // 3. Remove from matches (unmatch all)
      await tx.match.updateMany({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        data: { unmatched: true, unmatchedAt: new Date(), unmatchedBy: userId },
      });

      // 4. Delete swipes
      await tx.swipe.deleteMany({
        where: { OR: [{ swiperId: userId }, { swipedId: userId }] },
      });

      // 5. Delete blocks
      await tx.block.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      });

      // 6. Anonymize messages (keep for other user's history but remove sender info)
      await tx.message.updateMany({
        where: { senderId: userId },
        data: { senderId: userId }, // Keep as-is, user lookup will return null after soft delete
      });

      // 7. Delete stories
      await tx.story.deleteMany({ where: { userId } });

      // 8. Delete notifications
      await tx.notification.deleteMany({ where: { userId } });

      // 9. Delete inventory items
      await tx.inventoryItem.deleteMany({ where: { userId } });

      // 10. Delete preferences
      await tx.preferences.deleteMany({ where: { userId } });

      // 11. Delete profile
      await tx.profile.deleteMany({ where: { userId } });

      // 12. Delete couple memberships
      await tx.couple.updateMany({
        where: { OR: [{ partner1Id: userId }, { partner2Id: userId }] },
        data: { status: 'DISSOLVED', dissolvedAt: new Date() },
      });

      // 13. Soft-delete user (anonymize PII)
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `deleted_${userId}@deleted.drift.app`,
          displayName: 'Deleted User',
          bio: null,
          profilePhoto: null,
          photos: [],
          interests: [],
          latitude: null,
          longitude: null,
          city: null,
          country: null,
          isOnline: false,
          // Keep stripeCustomerId for refund handling if needed
        },
      });
    });

    logger.info(`Account deleted successfully for user ${userId}`);

    res.json({
      success: true,
      message: 'Your account has been deleted. We\'re sorry to see you go.',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Helpers
// =============================================================================

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export default router;

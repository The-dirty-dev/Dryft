import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// =============================================================================
// Couple Management
// =============================================================================

// Get current couple
router.get('/current', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
      include: {
        partner1: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
        partner2: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
    });

    if (!couple) {
      res.json({ couple: null });
      return;
    }

    const partner = couple.partner1Id === req.user!.id
      ? couple.partner2
      : couple.partner1;

    res.json({
      couple: {
        id: couple.id,
        partner,
        relationship_type: couple.relationshipType,
        anniversary: couple.anniversary,
        nickname: couple.nickname,
        level: couple.level,
        xp: couple.xp,
        current_streak: couple.currentStreak,
        longest_streak: couple.longestStreak,
        relationship_score: couple.relationshipScore,
        last_activity_at: couple.lastActivityAt,
        created_at: couple.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create couple invite
router.post('/invite', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { partner_email, relationship_type, anniversary } = req.body;

    // Check if already in a couple
    const existingCouple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });

    if (existingCouple) {
      throw new AppError(409, 'Already in a relationship');
    }

    // Find partner by email
    const partner = await prisma.user.findUnique({
      where: { email: partner_email },
    });

    if (!partner) {
      throw new AppError(404, 'Partner not found');
    }

    if (partner.id === req.user!.id) {
      throw new AppError(400, 'Cannot invite yourself');
    }

    // Create invite code
    const inviteCode = uuid().slice(0, 8).toUpperCase();

    const couple = await prisma.couple.create({
      data: {
        partner1Id: req.user!.id,
        partner2Id: partner.id,
        relationshipType: relationship_type || 'DATING',
        anniversary: anniversary ? new Date(anniversary) : null,
        status: 'PENDING',
        inviteCode,
        invitedAt: new Date(),
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId: partner.id,
        type: 'COUPLE_INVITE',
        title: 'Couple Invite!',
        body: `${req.user!.displayName || 'Someone'} wants to connect with you on Drift`,
        data: { coupleId: couple.id, inviteCode },
      },
    });

    res.status(201).json({
      couple_id: couple.id,
      invite_code: inviteCode,
      status: 'PENDING',
    });
  } catch (error) {
    next(error);
  }
});

// Accept couple invite
router.post('/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { invite_code } = req.body;

    const couple = await prisma.couple.findFirst({
      where: {
        inviteCode: invite_code,
        partner2Id: req.user!.id,
        status: 'PENDING',
      },
    });

    if (!couple) {
      throw new AppError(404, 'Invite not found or expired');
    }

    await prisma.couple.update({
      where: { id: couple.id },
      data: {
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });

    // Notify partner1
    await prisma.notification.create({
      data: {
        userId: couple.partner1Id,
        type: 'SYSTEM',
        title: 'Invite Accepted! 💕',
        body: 'Your partner accepted the invite. Start your journey together!',
      },
    });

    res.json({ success: true, couple_id: couple.id });
  } catch (error) {
    next(error);
  }
});

// Update couple settings
router.put('/settings', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { nickname, relationship_type, anniversary } = req.body;

    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    await prisma.couple.update({
      where: { id: couple.id },
      data: {
        nickname,
        relationshipType: relationship_type,
        anniversary: anniversary ? new Date(anniversary) : undefined,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// End relationship
router.post('/end', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    await prisma.couple.update({
      where: { id: couple.id },
      data: { status: 'ENDED' },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Dashboard & Stats
// =============================================================================

// Get relationship dashboard
router.get('/dashboard', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
      include: {
        partner1: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
        partner2: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
    });

    if (!couple) {
      res.json({ has_couple: false });
      return;
    }

    const partner = couple.partner1Id === req.user!.id
      ? couple.partner2
      : couple.partner1;

    // Get recent activity
    const recentActivities = await prisma.coupleActivityCompletion.findMany({
      where: { coupleId: couple.id },
      include: { activity: true },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });

    // Get upcoming date
    const upcomingDate = await prisma.datePlan.findFirst({
      where: {
        coupleId: couple.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Calculate level progress
    const xpForNextLevel = couple.level * 100;
    const levelProgress = (couple.xp % 100) / xpForNextLevel;

    // Get daily activity (for streak)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayActivity = await prisma.coupleActivityCompletion.findFirst({
      where: {
        coupleId: couple.id,
        completedAt: { gte: today },
      },
    });

    res.json({
      has_couple: true,
      partner,
      stats: {
        level: couple.level,
        xp: couple.xp,
        xp_for_next_level: xpForNextLevel,
        level_progress: levelProgress,
        current_streak: couple.currentStreak,
        longest_streak: couple.longestStreak,
        relationship_score: couple.relationshipScore,
        days_together: Math.floor(
          (Date.now() - couple.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
      streak: {
        current: couple.currentStreak,
        completed_today: !!todayActivity,
        streak_at_risk: !todayActivity && couple.currentStreak > 0,
      },
      recent_activities: recentActivities.map(a => ({
        id: a.id,
        title: a.activity.title,
        category: a.activity.category,
        completed_at: a.completedAt,
        xp_earned: a.xpEarned,
      })),
      upcoming_date: upcomingDate ? {
        id: upcomingDate.id,
        title: upcomingDate.title,
        scheduled_at: upcomingDate.scheduledAt,
        type: upcomingDate.dateType,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Milestones
// =============================================================================

// Get milestones
router.get('/milestones', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const milestones = await prisma.coupleMilestone.findMany({
      where: { coupleId: couple.id },
      orderBy: { date: 'desc' },
    });

    res.json({
      milestones: milestones.map(m => ({
        id: m.id,
        type: m.type,
        title: m.title,
        description: m.description,
        date: m.date,
        photo_url: m.photoUrl,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Add milestone
router.post('/milestones', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { type, title, description, date, photo_url } = req.body;

    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const milestone = await prisma.coupleMilestone.create({
      data: {
        coupleId: couple.id,
        type: type || 'CUSTOM',
        title,
        description,
        date: new Date(date),
        photoUrl: photo_url,
      },
    });

    res.status(201).json({ milestone_id: milestone.id });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Memories
// =============================================================================

// Get memories
router.get('/memories', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const memories = await prisma.coupleMemory.findMany({
      where: { coupleId: couple.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({
      memories: memories.map(m => ({
        id: m.id,
        type: m.type,
        title: m.title,
        content: m.content,
        media_url: m.mediaUrl,
        location: m.location,
        mood: m.mood,
        created_at: m.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Add memory
router.post('/memories', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { type, title, content, media_url, location, mood } = req.body;

    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const memory = await prisma.coupleMemory.create({
      data: {
        coupleId: couple.id,
        type: type || 'NOTE',
        title,
        content,
        mediaUrl: media_url,
        location,
        mood,
      },
    });

    res.status(201).json({ memory_id: memory.id });
  } catch (error) {
    next(error);
  }
});

export default router;

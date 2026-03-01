import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Helper to get user's couple
async function getUserCouple(userId: string) {
  return prisma.couple.findFirst({
    where: {
      OR: [{ partner1Id: userId }, { partner2Id: userId }],
      status: 'ACTIVE',
    },
  });
}

const createDateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  date_type: z.enum(['VIRTUAL', 'IN_PERSON', 'WATCH_PARTY', 'GAME_NIGHT', 'COOK_TOGETHER', 'CUSTOM']),
  scheduled_at: z.string().datetime(),
  duration: z.number().int().min(15).max(480).optional(),
  location: z.string().max(200).optional(),
  meeting_url: z.string().url().optional(),
});

// =============================================================================
// Date Planning
// =============================================================================

// Get upcoming dates
router.get('/upcoming', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const dates = await prisma.datePlan.findMany({
      where: {
        coupleId: couple.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: new Date() },
      },
      include: {
        createdBy: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json({
      dates: dates.map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        date_type: d.dateType,
        scheduled_at: d.scheduledAt,
        duration: d.duration,
        location: d.location,
        meeting_url: d.meetingUrl,
        status: d.status,
        created_by: d.createdBy,
        is_mine: d.createdById === req.user!.id,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get past dates
router.get('/past', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const dates = await prisma.datePlan.findMany({
      where: {
        coupleId: couple.id,
        status: 'COMPLETED',
      },
      orderBy: { scheduledAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({
      dates: dates.map(d => ({
        id: d.id,
        title: d.title,
        date_type: d.dateType,
        scheduled_at: d.scheduledAt,
        rating: d.rating,
        xp_earned: d.xpEarned,
        completed_at: d.completedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Create a date
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = createDateSchema.parse(req.body);

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const partnerId = couple.partner1Id === req.user!.id
      ? couple.partner2Id
      : couple.partner1Id;

    const date = await prisma.datePlan.create({
      data: {
        coupleId: couple.id,
        createdById: req.user!.id,
        partnerId,
        title: data.title,
        description: data.description,
        dateType: data.date_type,
        scheduledAt: new Date(data.scheduled_at),
        duration: data.duration,
        location: data.location,
        meetingUrl: data.meeting_url,
        status: 'PENDING',
      },
    });

    // Notify partner
    await prisma.notification.create({
      data: {
        userId: partnerId,
        type: 'DATE_REMINDER',
        title: 'Date Invite! 💕',
        body: `You've been invited to: ${data.title}`,
        data: { dateId: date.id },
      },
    });

    res.status(201).json({ date_id: date.id });
  } catch (error) {
    next(error);
  }
});

// Confirm a date
router.post('/:dateId/confirm', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { dateId } = req.params;

    const date = await prisma.datePlan.findUnique({
      where: { id: dateId },
    });

    if (!date) {
      throw new AppError(404, 'Date not found');
    }

    if (date.partnerId !== req.user!.id) {
      throw new AppError(403, 'Only the invited partner can confirm');
    }

    await prisma.datePlan.update({
      where: { id: dateId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Notify creator
    await prisma.notification.create({
      data: {
        userId: date.createdById,
        type: 'SYSTEM',
        title: 'Date Confirmed! 🎉',
        body: `Your date "${date.title}" was confirmed!`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Cancel a date
router.post('/:dateId/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { dateId } = req.params;

    const date = await prisma.datePlan.findUnique({
      where: { id: dateId },
    });

    if (!date) {
      throw new AppError(404, 'Date not found');
    }

    if (date.createdById !== req.user!.id && date.partnerId !== req.user!.id) {
      throw new AppError(403, 'Not authorized');
    }

    await prisma.datePlan.update({
      where: { id: dateId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Notify other person
    const notifyUserId = date.createdById === req.user!.id
      ? date.partnerId
      : date.createdById;

    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        type: 'SYSTEM',
        title: 'Date Cancelled',
        body: `The date "${date.title}" was cancelled`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Complete a date
router.post('/:dateId/complete', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { dateId } = req.params;
    const { rating, notes } = req.body;

    const date = await prisma.datePlan.findUnique({
      where: { id: dateId },
      include: { couple: true },
    });

    if (!date) {
      throw new AppError(404, 'Date not found');
    }

    if (date.createdById !== req.user!.id && date.partnerId !== req.user!.id) {
      throw new AppError(403, 'Not authorized');
    }

    // Calculate XP based on duration and rating
    const baseXp = 30;
    const durationBonus = Math.min(Math.floor((date.duration || 60) / 30) * 5, 20);
    const ratingBonus = rating ? (rating - 3) * 5 : 0;
    const xpEarned = Math.max(baseXp + durationBonus + ratingBonus, 10);

    await prisma.datePlan.update({
      where: { id: dateId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        rating,
        notes,
        xpEarned,
      },
    });

    // Update couple XP
    await prisma.couple.update({
      where: { id: date.coupleId },
      data: {
        xp: { increment: xpEarned },
        relationshipScore: { increment: Math.floor(xpEarned / 2) },
      },
    });

    res.json({
      success: true,
      xp_earned: xpEarned,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Date Ideas
// =============================================================================

// Get date ideas/suggestions
router.get('/ideas', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { type } = req.query;

    // Curated date ideas
    const ideas = [
      // Virtual dates
      { type: 'VIRTUAL', title: 'Virtual Movie Night', description: 'Watch a movie together using streaming sync', duration: 120, icon: '🎬' },
      { type: 'VIRTUAL', title: 'Online Game Session', description: 'Play multiplayer games together', duration: 90, icon: '🎮' },
      { type: 'VIRTUAL', title: 'Virtual Stargazing', description: 'Use a stargazing app together', duration: 60, icon: '✨' },
      { type: 'VIRTUAL', title: 'Virtual Museum Tour', description: 'Explore virtual museum tours together', duration: 60, icon: '🏛️' },
      { type: 'VIRTUAL', title: 'Read Together', description: 'Read the same book and discuss', duration: 45, icon: '📚' },

      // Watch parties
      { type: 'WATCH_PARTY', title: 'TV Show Binge', description: 'Start a new series together', duration: 180, icon: '📺' },
      { type: 'WATCH_PARTY', title: 'Documentary Night', description: 'Learn something new together', duration: 90, icon: '🎥' },

      // Game nights
      { type: 'GAME_NIGHT', title: 'Trivia Challenge', description: 'Test your knowledge together', duration: 60, icon: '🧠' },
      { type: 'GAME_NIGHT', title: 'Card Games Online', description: 'Play classic card games virtually', duration: 60, icon: '🃏' },
      { type: 'GAME_NIGHT', title: 'Drawing Together', description: 'Play Pictionary-style games', duration: 45, icon: '🎨' },

      // Cook together
      { type: 'COOK_TOGETHER', title: 'Same Recipe Challenge', description: 'Cook the same recipe simultaneously', duration: 90, icon: '👨‍🍳' },
      { type: 'COOK_TOGETHER', title: 'Baking Date', description: 'Bake desserts together on video', duration: 120, icon: '🧁' },
      { type: 'COOK_TOGETHER', title: 'Cultural Cuisine', description: 'Try making a dish from a new culture', duration: 90, icon: '🍜' },

      // In-person
      { type: 'IN_PERSON', title: 'Picnic in the Park', description: 'Pack a lunch and enjoy outdoors', duration: 120, icon: '🧺' },
      { type: 'IN_PERSON', title: 'Sunset Walk', description: 'Take a walk during golden hour', duration: 60, icon: '🌅' },
      { type: 'IN_PERSON', title: 'Try a New Restaurant', description: 'Explore new cuisine together', duration: 90, icon: '🍽️' },
    ];

    const filtered = type
      ? ideas.filter(i => i.type === type)
      : ideas;

    res.json({ ideas: filtered });
  } catch (error) {
    next(error);
  }
});

export default router;

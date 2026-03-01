import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as push from '../services/push.js';

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

// Helper to add XP and update streak
async function addXpAndUpdateStreak(coupleId: string, xp: number) {
  const couple = await prisma.couple.findUnique({ where: { id: coupleId } });
  if (!couple) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActivity = couple.lastActivityAt;

  let newStreak = couple.currentStreak;

  if (lastActivity) {
    const lastActivityDate = new Date(
      lastActivity.getFullYear(),
      lastActivity.getMonth(),
      lastActivity.getDate()
    );
    const daysDiff = Math.floor(
      (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      // Consecutive day - increase streak
      newStreak += 1;
    } else if (daysDiff > 1) {
      // Streak broken - reset
      newStreak = 1;
    }
    // Same day - no change to streak
  } else {
    newStreak = 1;
  }

  // Calculate new XP and level
  const newXp = couple.xp + xp;
  const newLevel = Math.floor(newXp / 100) + 1;

  await prisma.couple.update({
    where: { id: coupleId },
    data: {
      xp: newXp,
      level: newLevel,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, couple.longestStreak),
      lastActivityAt: now,
      relationshipScore: couple.relationshipScore + Math.floor(xp / 2),
    },
  });

  return { newXp, newLevel, newStreak };
}

// =============================================================================
// Browse Activities
// =============================================================================

// Get available activities
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { category, difficulty, daily, weekly } = req.query;

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (daily === 'true') where.isDaily = true;
    if (weekly === 'true') where.isWeekly = true;

    const activities = await prisma.coupleActivity.findMany({
      where,
      orderBy: [{ isDaily: 'desc' }, { isWeekly: 'desc' }, { createdAt: 'desc' }],
    });

    // Get user's completed activities
    const couple = await getUserCouple(req.user!.id);
    let completedIds: string[] = [];

    if (couple) {
      const completions = await prisma.coupleActivityCompletion.findMany({
        where: {
          coupleId: couple.id,
          status: 'COMPLETED',
        },
        select: { activityId: true },
      });
      completedIds = completions.map(c => c.activityId);
    }

    res.json({
      activities: activities.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category,
        difficulty: a.difficulty,
        duration: a.duration,
        is_virtual: a.isVirtual,
        requires_both: a.requiresBoth,
        xp_reward: a.xpReward,
        icon_url: a.iconUrl,
        image_url: a.imageUrl,
        is_daily: a.isDaily,
        is_weekly: a.isWeekly,
        is_premium: a.isPremium,
        is_completed: completedIds.includes(a.id),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get daily activity
router.get('/daily', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    // Get today's date seed for consistent daily activity
    const today = new Date();
    const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

    const dailyActivities = await prisma.coupleActivity.findMany({
      where: { isActive: true, isDaily: true },
    });

    if (dailyActivities.length === 0) {
      // Fallback to any activity
      const anyActivity = await prisma.coupleActivity.findFirst({
        where: { isActive: true },
      });
      if (!anyActivity) {
        res.json({ daily_activity: null });
        return;
      }
      dailyActivities.push(anyActivity);
    }

    // Use date seed to pick consistent daily activity
    const activity = dailyActivities[dateSeed % dailyActivities.length];

    // Check if already completed today
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const completion = await prisma.coupleActivityCompletion.findFirst({
      where: {
        coupleId: couple.id,
        activityId: activity.id,
        completedAt: { gte: todayStart },
      },
    });

    res.json({
      daily_activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        instructions: activity.instructions,
        category: activity.category,
        duration: activity.duration,
        xp_reward: activity.xpReward,
        icon_url: activity.iconUrl,
        is_completed: !!completion,
        streak_bonus: couple.currentStreak >= 7 ? Math.floor(activity.xpReward * 0.5) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get activity by ID
router.get('/:activityId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { activityId } = req.params;

    const activity = await prisma.coupleActivity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new AppError(404, 'Activity not found');
    }

    res.json({
      activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        instructions: activity.instructions,
        category: activity.category,
        difficulty: activity.difficulty,
        duration: activity.duration,
        is_virtual: activity.isVirtual,
        requires_both: activity.requiresBoth,
        xp_reward: activity.xpReward,
        icon_url: activity.iconUrl,
        image_url: activity.imageUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Activity Participation
// =============================================================================

// Start an activity
router.post('/:activityId/start', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { activityId } = req.params;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const activity = await prisma.coupleActivity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new AppError(404, 'Activity not found');
    }

    // Check for existing in-progress
    const existing = await prisma.coupleActivityCompletion.findFirst({
      where: {
        coupleId: couple.id,
        activityId,
        status: 'IN_PROGRESS',
      },
    });

    if (existing) {
      res.json({ completion_id: existing.id, already_started: true });
      return;
    }

    const completion = await prisma.coupleActivityCompletion.create({
      data: {
        coupleId: couple.id,
        activityId,
        completedById: req.user!.id,
        status: 'IN_PROGRESS',
      },
    });

    res.status(201).json({ completion_id: completion.id });
  } catch (error) {
    next(error);
  }
});

// Submit activity response
router.post('/:activityId/submit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { activityId } = req.params;
    const { response, rating } = req.body;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const activity = await prisma.coupleActivity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new AppError(404, 'Activity not found');
    }

    // Find or create completion
    let completion = await prisma.coupleActivityCompletion.findFirst({
      where: {
        coupleId: couple.id,
        activityId,
        status: { in: ['IN_PROGRESS', 'WAITING_PARTNER'] },
      },
    });

    const isInitiator = completion?.completedById === req.user!.id;

    if (completion) {
      if (isInitiator) {
        // Update own response
        await prisma.coupleActivityCompletion.update({
          where: { id: completion.id },
          data: { response, rating },
        });
      } else {
        // Partner submitting
        await prisma.coupleActivityCompletion.update({
          where: { id: completion.id },
          data: { partnerResponse: response },
        });
      }

      // Check if both partners submitted (if required)
      if (activity.requiresBoth) {
        const updated = await prisma.coupleActivityCompletion.findUnique({
          where: { id: completion.id },
        });

        if (updated?.response && updated?.partnerResponse) {
          // Both submitted - complete!
          const xpEarned = activity.xpReward + (activity.streakBonus && couple.currentStreak >= 7
            ? Math.floor(activity.xpReward * 0.5)
            : 0);

          await prisma.coupleActivityCompletion.update({
            where: { id: completion.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              xpEarned,
            },
          });

          const result = await addXpAndUpdateStreak(couple.id, xpEarned);

          // Notify both partners about completion
          const partnerId = couple.partner1Id === req.user!.id ? couple.partner2Id : couple.partner1Id;
          const currentUser = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { displayName: true },
          });

          push.sendPartnerActivityNotification(
            partnerId,
            currentUser?.displayName || 'Your partner',
            activity.title
          ).catch(err => console.error('Push notification failed:', err));

          res.json({
            success: true,
            completed: true,
            xp_earned: xpEarned,
            new_level: result?.newLevel,
            new_streak: result?.newStreak,
          });
          return;
        } else {
          // Waiting for partner
          await prisma.coupleActivityCompletion.update({
            where: { id: completion.id },
            data: { status: 'WAITING_PARTNER' },
          });

          // Notify partner to complete their part
          const partnerId = couple.partner1Id === req.user!.id ? couple.partner2Id : couple.partner1Id;
          const currentUser = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { displayName: true },
          });

          push.sendPushNotification(partnerId, {
            title: 'Your turn! 💕',
            body: `${currentUser?.displayName || 'Your partner'} started "${activity.title}" - join in!`,
            data: { type: 'ACTIVITY_WAITING', activityId: activity.id },
          }).catch(err => console.error('Push notification failed:', err));

          res.json({ success: true, waiting_for_partner: true });
          return;
        }
      }
    } else {
      // Create new completion
      completion = await prisma.coupleActivityCompletion.create({
        data: {
          coupleId: couple.id,
          activityId,
          completedById: req.user!.id,
          response,
          rating,
          status: activity.requiresBoth ? 'WAITING_PARTNER' : 'COMPLETED',
          completedAt: activity.requiresBoth ? undefined : new Date(),
          xpEarned: activity.requiresBoth ? 0 : activity.xpReward,
        },
      });

      if (!activity.requiresBoth) {
        const result = await addXpAndUpdateStreak(couple.id, activity.xpReward);
        res.json({
          success: true,
          completed: true,
          xp_earned: activity.xpReward,
          new_level: result?.newLevel,
          new_streak: result?.newStreak,
        });
        return;
      }
    }

    res.json({
      success: true,
      waiting_for_partner: activity.requiresBoth,
    });
  } catch (error) {
    next(error);
  }
});

// Get activity history
router.get('/history/all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const completions = await prisma.coupleActivityCompletion.findMany({
      where: { coupleId: couple.id },
      include: { activity: true },
      orderBy: { startedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({
      history: completions.map(c => ({
        id: c.id,
        activity: {
          id: c.activity.id,
          title: c.activity.title,
          category: c.activity.category,
          icon_url: c.activity.iconUrl,
        },
        status: c.status,
        rating: c.rating,
        xp_earned: c.xpEarned,
        started_at: c.startedAt,
        completed_at: c.completedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

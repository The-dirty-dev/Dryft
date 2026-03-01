import { Router } from 'express';
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

// =============================================================================
// Achievements
// =============================================================================

// Get all achievements
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { category } = req.query;

    const where: any = { isActive: true };
    if (category) where.category = category;

    const achievements = await prisma.achievement.findMany({
      where,
      orderBy: [{ rarity: 'asc' }, { createdAt: 'asc' }],
    });

    // Get user's earned achievements
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: req.user!.id },
    });

    const earnedMap = new Map(
      userAchievements.map(ua => [ua.achievementId, ua])
    );

    res.json({
      achievements: achievements.map(a => {
        const earned = earnedMap.get(a.id);
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          rarity: a.rarity,
          xp_reward: a.xpReward,
          icon_url: a.iconUrl,
          badge_url: a.badgeUrl,
          is_earned: !!earned,
          earned_at: earned?.earnedAt,
          progress: earned?.progress || 0,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

// Get user's earned achievements
router.get('/earned', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: req.user!.id },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });

    res.json({
      achievements: userAchievements.map(ua => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        category: ua.achievement.category,
        rarity: ua.achievement.rarity,
        icon_url: ua.achievement.iconUrl,
        badge_url: ua.achievement.badgeUrl,
        earned_at: ua.earnedAt,
      })),
      total_earned: userAchievements.length,
      total_xp: userAchievements.reduce(
        (sum, ua) => sum + ua.achievement.xpReward,
        0
      ),
    });
  } catch (error) {
    next(error);
  }
});

// Get achievement categories
router.get('/categories', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const categories = [
      { id: 'STREAK', name: 'Streak Master', description: 'Achievements for maintaining streaks', icon: '🔥' },
      { id: 'ACTIVITY', name: 'Activity Champion', description: 'Complete activities together', icon: '⭐' },
      { id: 'QUIZ', name: 'Quiz Wizard', description: 'Ace your relationship quizzes', icon: '🧠' },
      { id: 'MILESTONE', name: 'Milestone Maker', description: 'Celebrate relationship milestones', icon: '🏆' },
      { id: 'SOCIAL', name: 'Social Butterfly', description: 'Engage with the community', icon: '🦋' },
      { id: 'SPECIAL', name: 'Special', description: 'Limited-time and seasonal achievements', icon: '✨' },
    ];

    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// Get leaderboard
router.get('/leaderboard', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { type = 'xp' } = req.query;

    const couple = await getUserCouple(req.user!.id);

    // Get top couples by XP or streak
    const orderBy = type === 'streak'
      ? { currentStreak: 'desc' as const }
      : { xp: 'desc' as const };

    const topCouples = await prisma.couple.findMany({
      where: { status: 'ACTIVE' },
      orderBy,
      take: 50,
      include: {
        partner1: {
          select: { displayName: true, profilePhoto: true },
        },
        partner2: {
          select: { displayName: true, profilePhoto: true },
        },
      },
    });

    // Find user's rank
    let userRank: number | null = null;
    if (couple) {
      const userIndex = topCouples.findIndex(c => c.id === couple.id);
      if (userIndex >= 0) {
        userRank = userIndex + 1;
      } else {
        // Count couples ahead of user
        const aheadCount = await prisma.couple.count({
          where: {
            status: 'ACTIVE',
            [type === 'streak' ? 'currentStreak' : 'xp']: {
              gt: type === 'streak' ? couple.currentStreak : couple.xp,
            },
          },
        });
        userRank = aheadCount + 1;
      }
    }

    res.json({
      leaderboard: topCouples.map((c, index) => ({
        rank: index + 1,
        couple_id: c.id,
        nickname: c.nickname || `${c.partner1.displayName} & ${c.partner2.displayName}`,
        partner1_photo: c.partner1.profilePhoto,
        partner2_photo: c.partner2.profilePhoto,
        level: c.level,
        xp: c.xp,
        streak: c.currentStreak,
        is_current_user: couple?.id === c.id,
      })),
      user_rank: userRank,
      user_stats: couple ? {
        level: couple.level,
        xp: couple.xp,
        streak: couple.currentStreak,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Achievement Progress Tracking
// =============================================================================

// Check and award achievements (called internally)
export async function checkAchievements(userId: string, coupleId: string) {
  const couple = await prisma.couple.findUnique({ where: { id: coupleId } });
  if (!couple) return;

  const achievements = await prisma.achievement.findMany({
    where: { isActive: true },
  });

  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId },
  });
  const earnedIds = new Set(userAchievements.map(ua => ua.achievementId));

  const newAchievements: string[] = [];

  for (const achievement of achievements) {
    if (earnedIds.has(achievement.id)) continue;

    const requirement = achievement.requirement as {
      type: string;
      value: number;
    };

    let earned = false;

    switch (requirement.type) {
      case 'streak':
        if (couple.currentStreak >= requirement.value) {
          earned = true;
        }
        break;

      case 'level':
        if (couple.level >= requirement.value) {
          earned = true;
        }
        break;

      case 'activities': {
        const activityCount = await prisma.coupleActivityCompletion.count({
          where: { coupleId, status: 'COMPLETED' },
        });
        if (activityCount >= requirement.value) {
          earned = true;
        }
        break;
      }

      case 'quizzes': {
        const quizCount = await prisma.quizAttempt.count({
          where: { coupleId, completedAt: { not: null } },
        });
        if (quizCount >= requirement.value) {
          earned = true;
        }
        break;
      }

      case 'dates': {
        const dateCount = await prisma.datePlan.count({
          where: { coupleId, status: 'COMPLETED' },
        });
        if (dateCount >= requirement.value) {
          earned = true;
        }
        break;
      }

      case 'days_together': {
        const daysTogether = Math.floor(
          (Date.now() - couple.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysTogether >= requirement.value) {
          earned = true;
        }
        break;
      }
    }

    if (earned) {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
          progress: requirement.value,
        },
      });

      // Add XP
      await prisma.couple.update({
        where: { id: coupleId },
        data: { xp: { increment: achievement.xpReward } },
      });

      newAchievements.push(achievement.id);

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'ACHIEVEMENT',
          title: 'Achievement Unlocked! 🏆',
          body: `You earned: ${achievement.name}`,
          data: { achievementId: achievement.id },
        },
      });
    }
  }

  return newAchievements;
}

export default router;

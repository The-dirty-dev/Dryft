import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// =============================================================================
// Reward Configuration
// =============================================================================

// Base XP rewards
const DAILY_LOGIN_XP = 10;
const STREAK_BONUS_PER_DAY = 5; // Extra XP per streak day (capped)
const MAX_STREAK_BONUS = 50; // Max bonus at 10+ day streak

// Streak milestones with special rewards
const STREAK_MILESTONES: Record<number, { xp: number; badge?: string; title: string }> = {
  3: { xp: 25, title: '3-Day Streak!' },
  7: { xp: 50, badge: 'STREAK_WEEK', title: 'Week Warrior!' },
  14: { xp: 100, badge: 'STREAK_2WEEKS', title: 'Dedicated Duo!' },
  30: { xp: 200, badge: 'STREAK_MONTH', title: 'Monthly Masters!' },
  60: { xp: 400, badge: 'STREAK_2MONTHS', title: 'Unstoppable!' },
  100: { xp: 1000, badge: 'STREAK_100', title: 'Century Club!' },
  365: { xp: 5000, badge: 'STREAK_YEAR', title: 'Year of Love!' },
};

// Daily reward tiers (day of streak -> reward)
const DAILY_REWARDS = [
  { day: 1, xp: 10, coins: 0 },
  { day: 2, xp: 15, coins: 0 },
  { day: 3, xp: 20, coins: 5 },
  { day: 4, xp: 25, coins: 0 },
  { day: 5, xp: 30, coins: 0 },
  { day: 6, xp: 35, coins: 0 },
  { day: 7, xp: 50, coins: 10 }, // Weekly bonus
];

// =============================================================================
// Helper Functions
// =============================================================================

function calculateStreakBonus(streakDays: number): number {
  return Math.min(streakDays * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS);
}

function getDailyReward(streakDay: number): { xp: number; coins: number } {
  // Cycle through the 7-day rewards, with day 7+ using day 7 rewards
  const dayIndex = Math.min(streakDay - 1, 6);
  return DAILY_REWARDS[dayIndex];
}

function getNextMilestone(currentStreak: number): { days: number; reward: typeof STREAK_MILESTONES[3] } | null {
  const milestones = Object.keys(STREAK_MILESTONES)
    .map(Number)
    .sort((a, b) => a - b);

  for (const days of milestones) {
    if (days > currentStreak) {
      return { days, reward: STREAK_MILESTONES[days] };
    }
  }
  return null;
}

// Check if user has claimed today's reward
async function hasClaimedToday(userId: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reward = await prisma.dailyReward.findFirst({
    where: {
      userId,
      claimedAt: { gte: today },
    },
  });

  return !!reward;
}

// Get user's current login streak
async function getUserStreak(userId: string): Promise<{
  current: number;
  lastClaim: Date | null;
  isActive: boolean;
}> {
  const lastReward = await prisma.dailyReward.findFirst({
    where: { userId },
    orderBy: { claimedAt: 'desc' },
  });

  if (!lastReward) {
    return { current: 0, lastClaim: null, isActive: false };
  }

  const now = new Date();
  const lastClaim = new Date(lastReward.claimedAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastClaimDay = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

  const daysDiff = Math.floor((today.getTime() - lastClaimDay.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    // Claimed today
    return { current: lastReward.streakDay, lastClaim: lastReward.claimedAt, isActive: true };
  } else if (daysDiff === 1) {
    // Yesterday - streak continues
    return { current: lastReward.streakDay, lastClaim: lastReward.claimedAt, isActive: true };
  } else {
    // Streak broken
    return { current: 0, lastClaim: lastReward.claimedAt, isActive: false };
  }
}

// =============================================================================
// Routes
// =============================================================================

// Get daily reward status
router.get('/daily', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const claimed = await hasClaimedToday(userId);
    const streak = await getUserStreak(userId);

    // Calculate what today's reward would be
    const nextStreakDay = streak.isActive ? streak.current + 1 : 1;
    const todayReward = getDailyReward(nextStreakDay);
    const streakBonus = calculateStreakBonus(nextStreakDay);
    const nextMilestone = getNextMilestone(streak.current);

    // Check for milestone reward
    let milestoneReward = null;
    if (STREAK_MILESTONES[nextStreakDay]) {
      milestoneReward = {
        ...STREAK_MILESTONES[nextStreakDay],
        streak_day: nextStreakDay,
      };
    }

    // Get recent reward history
    const history = await prisma.dailyReward.findMany({
      where: { userId },
      orderBy: { claimedAt: 'desc' },
      take: 7,
    });

    res.json({
      claimed_today: claimed,
      streak: {
        current: streak.current,
        is_active: streak.isActive,
        last_claim: streak.lastClaim?.toISOString() || null,
      },
      today_reward: claimed ? null : {
        xp: todayReward.xp + streakBonus,
        base_xp: todayReward.xp,
        streak_bonus: streakBonus,
        coins: todayReward.coins,
        streak_day: nextStreakDay,
        milestone_reward: milestoneReward,
      },
      next_milestone: nextMilestone ? {
        days: nextMilestone.days,
        days_away: nextMilestone.days - (streak.isActive ? streak.current : 0),
        xp_reward: nextMilestone.reward.xp,
        title: nextMilestone.reward.title,
        badge: nextMilestone.reward.badge || null,
      } : null,
      history: history.map(h => ({
        date: h.claimedAt.toISOString(),
        streak_day: h.streakDay,
        xp_earned: h.xpEarned,
        coins_earned: h.coinsEarned,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Claim daily reward
router.post('/daily/claim', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Check if already claimed
    const claimed = await hasClaimedToday(userId);
    if (claimed) {
      throw new AppError(400, 'Daily reward already claimed today');
    }

    // Get current streak
    const streak = await getUserStreak(userId);
    const newStreakDay = streak.isActive ? streak.current + 1 : 1;

    // Calculate rewards
    const dailyReward = getDailyReward(newStreakDay);
    const streakBonus = calculateStreakBonus(newStreakDay);
    const totalXp = dailyReward.xp + streakBonus;

    // Check for milestone
    const milestoneReward = STREAK_MILESTONES[newStreakDay];
    let milestoneXp = 0;
    let earnedBadge: string | null = null;

    if (milestoneReward) {
      milestoneXp = milestoneReward.xp;
      earnedBadge = milestoneReward.badge || null;
    }

    // Create reward record and update user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create daily reward record
      const reward = await tx.dailyReward.create({
        data: {
          userId,
          streakDay: newStreakDay,
          xpEarned: totalXp + milestoneXp,
          coinsEarned: dailyReward.coins,
          milestoneReached: milestoneReward ? milestoneReward.title : null,
        },
      });

      // Update couple XP if in a relationship
      const couple = await tx.couple.findFirst({
        where: {
          OR: [{ partner1Id: userId }, { partner2Id: userId }],
          status: 'ACTIVE',
        },
      });

      if (couple) {
        const currentStreak = Math.max(couple.currentStreak, newStreakDay);
        const longestStreak = Math.max(couple.longestStreak, newStreakDay);

        await tx.couple.update({
          where: { id: couple.id },
          data: {
            xp: { increment: totalXp + milestoneXp },
            currentStreak: currentStreak,
            longestStreak: longestStreak,
            lastActivityAt: new Date(),
            // Level up if needed (100 XP per level)
            level: Math.floor((couple.xp + totalXp + milestoneXp) / 100) + 1,
          },
        });
      }

      // Award milestone achievement if applicable
      if (earnedBadge) {
        const achievement = await tx.achievement.findFirst({
          where: { name: earnedBadge },
        });

        if (achievement) {
          await tx.userAchievement.upsert({
            where: {
              userId_achievementId: {
                userId,
                achievementId: achievement.id,
              },
            },
            create: {
              userId,
              achievementId: achievement.id,
              earnedAt: new Date(),
            },
            update: {}, // Already has it
          });
        }
      }

      // Create notification
      await tx.notification.create({
        data: {
          userId,
          type: 'ACHIEVEMENT',
          title: milestoneReward ? milestoneReward.title : 'Daily Reward!',
          body: milestoneReward
            ? `You've reached a ${newStreakDay}-day streak! +${totalXp + milestoneXp} XP`
            : `Day ${newStreakDay} reward claimed! +${totalXp} XP`,
          data: {
            type: 'daily_reward',
            streak_day: newStreakDay,
            xp_earned: totalXp + milestoneXp,
          },
        },
      });

      return reward;
    });

    // Get updated streak info
    const nextMilestone = getNextMilestone(newStreakDay);

    res.json({
      success: true,
      reward: {
        xp_earned: totalXp + milestoneXp,
        base_xp: dailyReward.xp,
        streak_bonus: streakBonus,
        milestone_bonus: milestoneXp,
        coins_earned: dailyReward.coins,
        streak_day: newStreakDay,
        milestone_reached: milestoneReward ? {
          title: milestoneReward.title,
          badge: earnedBadge,
          xp: milestoneReward.xp,
        } : null,
      },
      next_milestone: nextMilestone ? {
        days: nextMilestone.days,
        days_away: nextMilestone.days - newStreakDay,
        xp_reward: nextMilestone.reward.xp,
        title: nextMilestone.reward.title,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// Get leaderboard (weekly streak rankings)
router.get('/leaderboard', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { type = 'streak' } = req.query;

    // Get top couples by streak or XP
    const orderBy = type === 'xp' ? { xp: 'desc' as const } : { currentStreak: 'desc' as const };

    const couples = await prisma.couple.findMany({
      where: { status: 'ACTIVE' },
      orderBy,
      take: 50,
      include: {
        partner1: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
        partner2: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
    });

    // Find current user's couple
    const userCouple = await prisma.couple.findFirst({
      where: {
        OR: [{ partner1Id: req.user!.id }, { partner2Id: req.user!.id }],
        status: 'ACTIVE',
      },
    });

    // Find user's rank
    let userRank = null;
    if (userCouple) {
      const rank = couples.findIndex(c => c.id === userCouple.id);
      if (rank !== -1) {
        userRank = rank + 1;
      } else {
        // User not in top 50, calculate actual rank
        const field = type === 'xp' ? 'xp' : 'currentStreak';
        const value = type === 'xp' ? userCouple.xp : userCouple.currentStreak;
        const count = await prisma.couple.count({
          where: {
            status: 'ACTIVE',
            [field]: { gt: value },
          },
        });
        userRank = count + 1;
      }
    }

    res.json({
      type,
      leaderboard: couples.map((c, index) => ({
        rank: index + 1,
        couple_id: c.id,
        partners: [
          {
            id: c.partner1.id,
            display_name: c.partner1.displayName,
            profile_photo: c.partner1.profilePhoto,
          },
          {
            id: c.partner2.id,
            display_name: c.partner2.displayName,
            profile_photo: c.partner2.profilePhoto,
          },
        ],
        current_streak: c.currentStreak,
        longest_streak: c.longestStreak,
        xp: c.xp,
        level: c.level,
        is_current_user: userCouple?.id === c.id,
      })),
      user_rank: userRank,
      user_stats: userCouple ? {
        current_streak: userCouple.currentStreak,
        longest_streak: userCouple.longestStreak,
        xp: userCouple.xp,
        level: userCouple.level,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

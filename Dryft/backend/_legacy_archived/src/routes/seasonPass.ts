import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { createPaymentIntent } from '../services/stripe.js';

const router = Router();

// =============================================================================
// Get Current Season
// =============================================================================

router.get('/current', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();

    const season = await prisma.season.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        tiers: { orderBy: { level: 'asc' } },
      },
    });

    if (!season) {
      res.json({ has_active_season: false });
      return;
    }

    // Get user's pass for this season
    const userPass = await prisma.seasonPass.findUnique({
      where: {
        userId_seasonId: {
          userId: req.user!.id,
          seasonId: season.id,
        },
      },
    });

    // Calculate time remaining
    const msRemaining = season.endsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    res.json({
      has_active_season: true,
      season: {
        id: season.id,
        name: season.name,
        description: season.description,
        theme: season.theme,
        starts_at: season.startsAt.toISOString(),
        ends_at: season.endsAt.toISOString(),
        days_remaining: daysRemaining,
        pass_price: season.passPrice,
        premium_pass_price: season.premiumPassPrice,
      },
      user_progress: userPass ? {
        pass_type: userPass.passType,
        current_level: userPass.currentLevel,
        current_xp: userPass.currentXp,
        claimed_tiers: userPass.claimedTiers,
        has_premium: userPass.passType === 'PREMIUM',
      } : {
        pass_type: 'FREE',
        current_level: 1,
        current_xp: 0,
        claimed_tiers: [],
        has_premium: false,
      },
      tiers: season.tiers.map(tier => ({
        level: tier.level,
        xp_required: tier.xpRequired,
        free_reward: tier.freeRewardType ? {
          type: tier.freeRewardType,
          value: tier.freeRewardValue,
        } : null,
        premium_reward: tier.premiumRewardType ? {
          type: tier.premiumRewardType,
          value: tier.premiumRewardValue,
        } : null,
        is_claimed: userPass?.claimedTiers.includes(tier.level) || false,
        is_unlocked: (userPass?.currentLevel || 1) >= tier.level,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Purchase Season Pass
// =============================================================================

router.post('/purchase', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { pass_type, payment_method_id } = req.body;

    if (!['PREMIUM'].includes(pass_type)) {
      throw new AppError(400, 'Invalid pass type');
    }

    const now = new Date();

    const season = await prisma.season.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    if (!season) {
      throw new AppError(404, 'No active season');
    }

    // Check if already has premium pass
    const existingPass = await prisma.seasonPass.findUnique({
      where: {
        userId_seasonId: {
          userId: req.user!.id,
          seasonId: season.id,
        },
      },
    });

    if (existingPass?.passType === 'PREMIUM') {
      throw new AppError(409, 'Already have premium pass');
    }

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true },
    });

    // Create payment intent
    const paymentIntent = await createPaymentIntent({
      userId: req.user!.id,
      email: user!.email,
      amount: season.premiumPassPrice,
      currency: 'usd',
      metadata: {
        type: 'season_pass',
        seasonId: season.id,
        passType: 'PREMIUM',
      },
    });

    res.json({
      client_secret: paymentIntent.client_secret,
      amount: season.premiumPassPrice,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Confirm Pass Purchase
// =============================================================================

router.post('/confirm-purchase', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { season_id } = req.body;

    const season = await prisma.season.findUnique({
      where: { id: season_id },
    });

    if (!season) {
      throw new AppError(404, 'Season not found');
    }

    // Upsert pass to premium
    const pass = await prisma.seasonPass.upsert({
      where: {
        userId_seasonId: {
          userId: req.user!.id,
          seasonId: season_id,
        },
      },
      create: {
        userId: req.user!.id,
        seasonId: season_id,
        passType: 'PREMIUM',
        purchasedAt: new Date(),
      },
      update: {
        passType: 'PREMIUM',
        purchasedAt: new Date(),
      },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        type: 'SYSTEM',
        title: 'Premium Pass Activated!',
        body: `You now have the ${season.name} Premium Pass. Enjoy exclusive rewards!`,
      },
    });

    res.json({ success: true, pass_type: pass.passType });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Add XP (internal endpoint, called by other services)
// =============================================================================

router.post('/add-xp', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { xp_amount, source } = req.body;

    if (!xp_amount || xp_amount < 1) {
      throw new AppError(400, 'Invalid XP amount');
    }

    const now = new Date();

    const season = await prisma.season.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        tiers: { orderBy: { level: 'asc' } },
      },
    });

    if (!season) {
      res.json({ success: false, message: 'No active season' });
      return;
    }

    // Get or create user's pass
    let pass = await prisma.seasonPass.findUnique({
      where: {
        userId_seasonId: {
          userId: req.user!.id,
          seasonId: season.id,
        },
      },
    });

    if (!pass) {
      pass = await prisma.seasonPass.create({
        data: {
          userId: req.user!.id,
          seasonId: season.id,
          passType: 'FREE',
          currentXp: 0,
          currentLevel: 1,
        },
      });
    }

    // Add XP and calculate new level
    const newXp = pass.currentXp + xp_amount;
    let newLevel = pass.currentLevel;

    for (const tier of season.tiers) {
      if (newXp >= tier.xpRequired && tier.level > newLevel) {
        newLevel = tier.level;
      }
    }

    const leveledUp = newLevel > pass.currentLevel;

    // Update pass
    await prisma.seasonPass.update({
      where: { id: pass.id },
      data: {
        currentXp: newXp,
        currentLevel: newLevel,
      },
    });

    // Notify if leveled up
    if (leveledUp) {
      const newTier = season.tiers.find(t => t.level === newLevel);
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          type: 'ACHIEVEMENT',
          title: 'Season Level Up!',
          body: `You reached Season Level ${newLevel}! Claim your rewards.`,
          data: {
            seasonId: season.id,
            level: newLevel,
            hasReward: !!(newTier?.freeRewardType || (pass.passType === 'PREMIUM' && newTier?.premiumRewardType)),
          },
        },
      });
    }

    res.json({
      success: true,
      xp_added: xp_amount,
      new_xp: newXp,
      new_level: newLevel,
      leveled_up: leveledUp,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Claim Tier Reward
// =============================================================================

router.post('/claim/:level', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const level = parseInt(req.params.level);

    const now = new Date();

    const season = await prisma.season.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        tiers: true,
      },
    });

    if (!season) {
      throw new AppError(404, 'No active season');
    }

    const tier = season.tiers.find(t => t.level === level);
    if (!tier) {
      throw new AppError(404, 'Tier not found');
    }

    const pass = await prisma.seasonPass.findUnique({
      where: {
        userId_seasonId: {
          userId: req.user!.id,
          seasonId: season.id,
        },
      },
    });

    if (!pass) {
      throw new AppError(400, 'No season pass');
    }

    if (pass.currentLevel < level) {
      throw new AppError(400, 'Tier not unlocked yet');
    }

    if (pass.claimedTiers.includes(level)) {
      throw new AppError(400, 'Tier already claimed');
    }

    // Determine rewards
    const rewards: Array<{ type: string; value: string }> = [];

    if (tier.freeRewardType && tier.freeRewardValue) {
      rewards.push({ type: tier.freeRewardType, value: tier.freeRewardValue });
    }

    if (pass.passType === 'PREMIUM' && tier.premiumRewardType && tier.premiumRewardValue) {
      rewards.push({ type: tier.premiumRewardType, value: tier.premiumRewardValue });
    }

    // Process rewards
    for (const reward of rewards) {
      await processReward(req.user!.id, reward.type, reward.value);
    }

    // Mark tier as claimed
    await prisma.seasonPass.update({
      where: { id: pass.id },
      data: {
        claimedTiers: [...pass.claimedTiers, level],
      },
    });

    res.json({
      success: true,
      level,
      rewards,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get Leaderboard
// =============================================================================

router.get('/leaderboard', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();

    const season = await prisma.season.findFirst({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    if (!season) {
      res.json({ has_active_season: false, leaderboard: [] });
      return;
    }

    const topPasses = await prisma.seasonPass.findMany({
      where: { seasonId: season.id },
      orderBy: [{ currentLevel: 'desc' }, { currentXp: 'desc' }],
      take: 50,
    });

    // Get user info
    const userIds = topPasses.map(p => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, profilePhoto: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Find current user's rank
    const userPass = await prisma.seasonPass.findUnique({
      where: {
        userId_seasonId: {
          userId: req.user!.id,
          seasonId: season.id,
        },
      },
    });

    let userRank = null;
    if (userPass) {
      const rank = topPasses.findIndex(p => p.userId === req.user!.id);
      if (rank !== -1) {
        userRank = rank + 1;
      } else {
        // Calculate actual rank
        const higherCount = await prisma.seasonPass.count({
          where: {
            seasonId: season.id,
            OR: [
              { currentLevel: { gt: userPass.currentLevel } },
              {
                currentLevel: userPass.currentLevel,
                currentXp: { gt: userPass.currentXp },
              },
            ],
          },
        });
        userRank = higherCount + 1;
      }
    }

    res.json({
      has_active_season: true,
      season_name: season.name,
      leaderboard: topPasses.map((p, index) => ({
        rank: index + 1,
        user: userMap.get(p.userId),
        level: p.currentLevel,
        xp: p.currentXp,
        pass_type: p.passType,
        is_current_user: p.userId === req.user!.id,
      })),
      user_rank: userRank,
      user_stats: userPass ? {
        level: userPass.currentLevel,
        xp: userPass.currentXp,
        pass_type: userPass.passType,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

async function processReward(userId: string, type: string, value: string): Promise<void> {
  switch (type) {
    case 'XP': {
      // Add XP to couple
      const couple = await prisma.couple.findFirst({
        where: {
          OR: [{ partner1Id: userId }, { partner2Id: userId }],
          status: 'ACTIVE',
        },
      });
      if (couple) {
        await prisma.couple.update({
          where: { id: couple.id },
          data: { xp: { increment: parseInt(value) } },
        });
      }
      break;
    }

    case 'BADGE': {
      // Award achievement/badge
      const achievement = await prisma.achievement.findFirst({
        where: { name: value },
      });
      if (achievement) {
        await prisma.userAchievement.upsert({
          where: {
            userId_achievementId: {
              userId,
              achievementId: achievement.id,
            },
          },
          create: { userId, achievementId: achievement.id },
          update: {},
        });
      }
      break;
    }

    case 'ITEM': {
      // Give store item
      const item = await prisma.storeItem.findFirst({
        where: { name: value, status: 'APPROVED' },
      });
      if (item) {
        await prisma.inventoryItem.upsert({
          where: {
            userId_itemId: { userId, itemId: item.id },
          },
          create: { userId, itemId: item.id },
          update: {},
        });
      }
      break;
    }

    case 'COINS': {
      // In a real app, you'd have a coins/currency system
      // For now, just log it
      console.log(`Award ${value} coins to user ${userId}`);
      break;
    }
  }
}

export default router;

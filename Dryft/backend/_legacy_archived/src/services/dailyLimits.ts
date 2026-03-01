import { prisma } from '../utils/prisma.js';
import * as cache from './cache.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// Daily Limit Configuration
// =============================================================================

export const DAILY_LIMITS = {
  FREE: {
    swipes: 15,
    messages: 15,
    superLikes: 1,
  },
  PLUS: {
    swipes: Infinity, // Unlimited
    messages: Infinity,
    superLikes: 5,
  },
  PREMIUM: {
    swipes: Infinity,
    messages: Infinity,
    superLikes: 10,
  },
  VIP: {
    swipes: Infinity,
    messages: Infinity,
    superLikes: Infinity,
  },
} as const;

type SubscriptionTier = keyof typeof DAILY_LIMITS;
type LimitType = 'swipes' | 'messages' | 'superLikes';

// =============================================================================
// Cache Key Helpers
// =============================================================================

function getDailyKey(userId: string, type: LimitType): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `daily:${type}:${userId}:${today}`;
}

// PERF-009: Cache key for user tier
function getTierCacheKey(userId: string): string {
  return `tier:${userId}`;
}

const TIER_CACHE_TTL = 300; // 5 minutes

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

// ERR-006: Track daily limit check failures for circuit breaker
const FAILURE_THRESHOLD = 5; // Allow after this many consecutive failures
const FAILURE_WINDOW_SECONDS = 60; // Reset failure count after this period

async function trackLimitCheckFailure(): Promise<boolean> {
  try {
    const failureKey = 'daily_limits:failures';
    const failures = await cache.get<number>(failureKey) || 0;
    await cache.set(failureKey, failures + 1, FAILURE_WINDOW_SECONDS);

    // Return true if we should allow the request (fail-open after threshold)
    return failures >= FAILURE_THRESHOLD;
  } catch {
    // If we can't track failures, allow the request
    return true;
  }
}

async function resetLimitCheckFailures(): Promise<void> {
  try {
    await cache.del('daily_limits:failures');
  } catch {
    // Ignore errors when resetting
  }
}

// =============================================================================
// Get User's Subscription Tier (includes shared subscriptions)
// =============================================================================

async function getUserTier(userId: string): Promise<SubscriptionTier> {
  // PERF-009: Check cache first
  const cacheKey = getTierCacheKey(userId);
  const cachedTier = await cache.get<SubscriptionTier>(cacheKey);
  if (cachedTier !== null) {
    return cachedTier;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
    },
  });

  if (!user) {
    await cache.set(cacheKey, 'FREE', TIER_CACHE_TTL);
    return 'FREE';
  }

  // Check if user has their own active subscription
  const tier = user.subscriptionTier as SubscriptionTier;
  if (tier !== 'FREE') {
    const isActive = user.subscriptionStatus === 'active' &&
      (!user.subscriptionEndsAt || user.subscriptionEndsAt > new Date());
    if (isActive) {
      await cache.set(cacheKey, tier, TIER_CACHE_TTL);
      return tier;
    }
  }

  // Check if user has access via shared subscription
  const sharedAccess = await prisma.sharedSubscriptionMember.findFirst({
    where: {
      userId: userId,
      status: 'ACCEPTED',
      sharedSubscription: {
        status: 'ACTIVE',
      },
    },
    include: {
      sharedSubscription: {
        select: {
          sharedTier: true,
          ownerId: true,
        },
      },
    },
  });

  if (sharedAccess) {
    // Verify the owner's subscription is still active
    const owner = await prisma.user.findUnique({
      where: { id: sharedAccess.sharedSubscription.ownerId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (owner) {
      const ownerActive = owner.subscriptionStatus === 'active' &&
        (!owner.subscriptionEndsAt || owner.subscriptionEndsAt > new Date());

      if (ownerActive && owner.subscriptionTier === sharedAccess.sharedSubscription.sharedTier) {
        const sharedTier = sharedAccess.sharedSubscription.sharedTier as SubscriptionTier;
        await cache.set(cacheKey, sharedTier, TIER_CACHE_TTL);
        return sharedTier;
      }
    }
  }

  // No active subscription found, default to FREE
  await cache.set(cacheKey, 'FREE', TIER_CACHE_TTL);
  return 'FREE';
}

// =============================================================================
// Get Current Usage
// =============================================================================

export async function getDailyUsage(userId: string, type: LimitType): Promise<number> {
  const key = getDailyKey(userId, type);

  // Try Redis first
  const cached = await cache.get<number>(key);
  if (cached !== null) {
    return cached;
  }

  // Fall back to database count for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let count = 0;

  if (type === 'swipes' || type === 'superLikes') {
    const whereClause: any = {
      swiperId: userId,
      createdAt: { gte: today },
    };
    if (type === 'superLikes') {
      whereClause.isSuperLike = true;
    }
    count = await prisma.swipe.count({ where: whereClause });
  } else if (type === 'messages') {
    count = await prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: today },
      },
    });
  }

  // Cache the count
  await cache.set(key, count, getSecondsUntilMidnight());

  return count;
}

// =============================================================================
// Check if User Can Perform Action
// =============================================================================

export interface LimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  isUnlimited: boolean;
  resetsAt: Date;
}

export async function checkDailyLimit(
  userId: string,
  type: LimitType
): Promise<LimitCheckResult> {
  const tier = await getUserTier(userId);
  const limit = DAILY_LIMITS[tier][type];
  const isUnlimited = limit === Infinity;

  // Calculate reset time (midnight)
  const resetsAt = new Date();
  resetsAt.setHours(24, 0, 0, 0);

  if (isUnlimited) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      used: 0, // Don't bother counting for unlimited
      isUnlimited: true,
      resetsAt,
    };
  }

  const used = await getDailyUsage(userId, type);
  const remaining = Math.max(0, limit - used);
  const allowed = remaining > 0;

  return {
    allowed,
    remaining,
    limit,
    used,
    isUnlimited: false,
    resetsAt,
  };
}

// =============================================================================
// Increment Usage
// =============================================================================

export async function incrementDailyUsage(
  userId: string,
  type: LimitType
): Promise<number> {
  const key = getDailyKey(userId, type);
  const ttl = getSecondsUntilMidnight();

  // Try to increment in Redis
  const newCount = await cache.incr(key);

  if (newCount !== null) {
    // Set TTL if this is the first increment of the day
    if (newCount === 1) {
      await cache.expire(key, ttl);
    }
    return newCount;
  }

  // Fall back: get current count and set incremented value
  const current = await getDailyUsage(userId, type);
  const incremented = current + 1;
  await cache.set(key, incremented, ttl);

  return incremented;
}

// =============================================================================
// Get All Daily Limits Status
// =============================================================================

export interface DailyLimitsStatus {
  tier: string;
  swipes: LimitCheckResult;
  messages: LimitCheckResult;
  superLikes: LimitCheckResult;
}

export async function getAllDailyLimits(userId: string): Promise<DailyLimitsStatus> {
  const tier = await getUserTier(userId);

  const [swipes, messages, superLikes] = await Promise.all([
    checkDailyLimit(userId, 'swipes'),
    checkDailyLimit(userId, 'messages'),
    checkDailyLimit(userId, 'superLikes'),
  ]);

  return {
    tier,
    swipes,
    messages,
    superLikes,
  };
}

// =============================================================================
// Middleware Factory
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export function dailyLimitMiddleware(type: LimitType) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return next(new AppError(401, 'Authentication required'));
    }

    try {
      const result = await checkDailyLimit(req.user.id, type);

      // Reset failure counter on successful check
      resetLimitCheckFailures().catch(() => {});

      // Add limit info to request for potential use in route
      (req as any).dailyLimit = result;

      if (!result.allowed) {
        const typeLabel = type === 'swipes' ? 'swipes' : type === 'messages' ? 'messages' : 'super likes';
        return res.status(429).json({
          error: `Daily ${typeLabel} limit reached`,
          code: 'DAILY_LIMIT_EXCEEDED',
          limit: result.limit,
          used: result.used,
          remaining: 0,
          resets_at: result.resetsAt.toISOString(),
          upgrade_message: 'Upgrade to Drift+ or Premium for unlimited access!',
        });
      }

      next();
    } catch (error: any) {
      // ERR-006: Track failures and implement controlled fail-open
      logger.error('Daily limit check failed:', {
        error: error.message,
        userId: req.user?.id,
        type,
      });

      const shouldAllow = await trackLimitCheckFailure();
      if (shouldAllow) {
        // Allow through after repeated failures to not block users
        logger.warn('Daily limit check bypassed due to repeated failures');
        next();
      } else {
        // First few failures: return error to prevent abuse
        res.status(503).json({
          error: 'Service temporarily unavailable',
          code: 'LIMIT_CHECK_FAILED',
          retry_after: 30,
        });
      }
    }
  };
}

// Pre-built middleware instances
export const swipeLimitMiddleware = dailyLimitMiddleware('swipes');
export const messageLimitMiddleware = dailyLimitMiddleware('messages');
export const superLikeLimitMiddleware = dailyLimitMiddleware('superLikes');

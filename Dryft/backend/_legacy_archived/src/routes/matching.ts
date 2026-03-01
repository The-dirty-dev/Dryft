import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { swipeRateLimit } from '../middleware/rateLimit.js';
import * as push from '../services/push.js';
import {
  swipeLimitMiddleware,
  superLikeLimitMiddleware,
  incrementDailyUsage,
  getAllDailyLimits,
} from '../services/dailyLimits.js';

const router = Router();

// =============================================================================
// Schemas
// =============================================================================

const swipeSchema = z.object({
  user_id: z.string().uuid(),
  direction: z.enum(['left', 'right']),
  is_super_like: z.boolean().optional(),
});

// =============================================================================
// Routes
// =============================================================================

// Get discovery profiles
router.get('/discover', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const userId = req.user!.id;

    // Run independent queries in parallel to avoid N+1 problem
    const [user, blocks, swipes] = await Promise.all([
      // Get user's preferences and location
      prisma.user.findUnique({
        where: { id: userId },
        include: { preferences: true },
      }),
      // Get blocked users (both directions)
      prisma.block.findMany({
        where: {
          OR: [
            { blockerId: userId },
            { blockedId: userId },
          ],
        },
        select: { blockerId: true, blockedId: true },
      }),
      // Get already swiped users
      prisma.swipe.findMany({
        where: { swiperId: userId },
        select: { swipedId: true },
      }),
    ]);

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const prefs = user.preferences;

    // Extract blocked IDs
    const blockedIds = blocks.map(b =>
      b.blockerId === userId ? b.blockedId : b.blockerId
    );

    // Extract swiped IDs
    const swipedIds = swipes.map(s => s.swipedId);

    // Build query with all exclusions
    const excludeIds = [...blockedIds, ...swipedIds, userId];

    const whereClause: any = {
      id: { notIn: excludeIds },
      deletedAt: null,
    };

    // Apply preferences
    if (prefs) {
      if (prefs.genderPreference.length > 0) {
        whereClause.gender = { in: prefs.genderPreference };
      }
      if (prefs.onlineOnly) {
        whereClause.isOnline = true;
      }
      if (prefs.verifiedOnly) {
        whereClause.verified = true;
      }
      if (prefs.vrReadyOnly) {
        whereClause.vrEnabled = true;
      }
    }

    // Get profiles
    const profiles = await prisma.user.findMany({
      where: whereClause,
      take: limit,
      include: { profile: true },
      orderBy: { lastActive: 'desc' },
    });

    // Calculate distances
    const profilesWithDistance = profiles.map(profile => {
      let distance: number | undefined;
      if (user.latitude && user.longitude && profile.latitude && profile.longitude) {
        distance = calculateDistance(
          user.latitude,
          user.longitude,
          profile.latitude,
          profile.longitude
        );
      }

      // Apply age filter
      if (prefs && profile.birthDate) {
        const age = calculateAge(profile.birthDate);
        if (age < prefs.minAge || age > prefs.maxAge) {
          return null;
        }
      }

      // Apply distance filter
      if (prefs && distance !== undefined && distance > prefs.maxDistance) {
        return null;
      }

      return {
        id: profile.id,
        display_name: profile.displayName,
        bio: profile.bio,
        profile_photo: profile.profilePhoto,
        photos: profile.photos,
        interests: profile.interests,
        verified: profile.verified,
        is_online: profile.isOnline,
        age: profile.birthDate ? calculateAge(profile.birthDate) : undefined,
        distance,
      };
    }).filter(Boolean);

    res.json({ profiles: profilesWithDistance });
  } catch (error) {
    next(error);
  }
});

// Swipe on a profile
router.post('/swipe', swipeRateLimit, authenticate, swipeLimitMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const data = swipeSchema.parse(req.body);

    // Check super like limit separately
    if (data.is_super_like) {
      const { swipeLimitMiddleware: _, ...limits } = await import('../services/dailyLimits.js');
      const superLikeCheck = await limits.checkDailyLimit(req.user!.id, 'superLikes');
      if (!superLikeCheck.allowed) {
        res.status(429).json({
          error: 'Daily super likes limit reached',
          code: 'DAILY_LIMIT_EXCEEDED',
          limit: superLikeCheck.limit,
          used: superLikeCheck.used,
          remaining: 0,
          resets_at: superLikeCheck.resetsAt.toISOString(),
          upgrade_message: 'Upgrade to get more super likes!',
        });
        return;
      }
    }

    // Check if already swiped
    const existingSwipe = await prisma.swipe.findUnique({
      where: {
        swiperId_swipedId: {
          swiperId: req.user!.id,
          swipedId: data.user_id,
        },
      },
    });

    if (existingSwipe) {
      throw new AppError(409, 'Already swiped on this user');
    }

    // Create swipe
    await prisma.swipe.create({
      data: {
        swiperId: req.user!.id,
        swipedId: data.user_id,
        direction: data.direction === 'right' ? 'RIGHT' : 'LEFT',
        isSuperLike: data.is_super_like || false,
      },
    });

    // Increment daily usage counters
    await incrementDailyUsage(req.user!.id, 'swipes');
    if (data.is_super_like) {
      await incrementDailyUsage(req.user!.id, 'superLikes');
    }

    // Check for match if swiped right
    let matched = false;
    let match_id: string | undefined;
    let matched_user: any;

    if (data.direction === 'right') {
      const theirSwipe = await prisma.swipe.findFirst({
        where: {
          swiperId: data.user_id,
          swipedId: req.user!.id,
          direction: 'RIGHT',
        },
      });

      if (theirSwipe) {
        // It's a match!
        const match = await prisma.match.create({
          data: {
            user1Id: req.user!.id,
            user2Id: data.user_id,
          },
        });

        // Create conversation
        await prisma.conversation.create({
          data: {
            matchId: match.id,
            participants: {
              create: [
                { userId: req.user!.id },
                { userId: data.user_id },
              ],
            },
          },
        });

        matched = true;
        match_id = match.id;

        // Get matched user info
        const matchedUserData = await prisma.user.findUnique({
          where: { id: data.user_id },
        });

        if (matchedUserData) {
          matched_user = {
            id: matchedUserData.id,
            display_name: matchedUserData.displayName,
            profile_photo: matchedUserData.profilePhoto,
          };
        }

        // Send push notifications to both users
        const currentUser = await prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { displayName: true, profilePhoto: true },
        });

        // Notify the other user about the match
        push.sendMatchNotification(
          data.user_id,
          currentUser?.displayName || 'Someone',
          currentUser?.profilePhoto || undefined
        ).catch(() => { /* Push error logged in service */ });

        // Notify current user about the match
        push.sendMatchNotification(
          req.user!.id,
          matchedUserData?.displayName || 'Someone',
          matchedUserData?.profilePhoto || undefined
        ).catch(() => { /* Push error logged in service */ });
      }
    } else if (data.direction === 'right') {
      // Send like notification to the other user (if they don't have a match yet)
      const targetUser = await prisma.user.findUnique({
        where: { id: data.user_id },
        select: { id: true, subscriptionTier: true },
      });

      if (targetUser) {
        const hasPremium = targetUser.subscriptionTier !== 'FREE';
        if (data.is_super_like) {
          const currentUser = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { displayName: true },
          });
          push.sendSuperLikeNotification(
            data.user_id,
            currentUser?.displayName || 'Someone'
          ).catch(() => { /* Push error logged in service */ });
        } else {
          push.sendLikeNotification(data.user_id, hasPremium)
            .catch(() => { /* Push error logged in service */ });
        }
      }
    }

    res.json({
      matched,
      match_id,
      matched_user,
    });
  } catch (error) {
    next(error);
  }
});

// Get matches
router.get('/matches', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: req.user!.id },
          { user2Id: req.user!.id },
        ],
        unmatched: false,
      },
      include: {
        user1: true,
        user2: true,
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { matchedAt: 'desc' },
    });

    const formattedMatches = matches.map(match => {
      const otherUser = match.user1Id === req.user!.id ? match.user2 : match.user1;
      const lastMessage = match.conversation?.messages[0];

      return {
        id: match.id,
        user: {
          id: otherUser.id,
          display_name: otherUser.displayName,
          profile_photo: otherUser.profilePhoto,
          is_online: otherUser.isOnline,
        },
        matched_at: match.matchedAt,
        last_message: lastMessage?.content,
        last_message_at: lastMessage?.createdAt,
        conversation_id: match.conversation?.id,
      };
    });

    res.json({ matches: formattedMatches });
  } catch (error) {
    next(error);
  }
});

// Unmatch
router.post('/unmatch/:matchId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { matchId } = req.params;

    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [
          { user1Id: req.user!.id },
          { user2Id: req.user!.id },
        ],
      },
    });

    if (!match) {
      throw new AppError(404, 'Match not found');
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        unmatched: true,
        unmatchedAt: new Date(),
        unmatchedBy: req.user!.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get users who liked you
router.get('/likes', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Get swipes where others swiped right on current user
    const likes = await prisma.swipe.findMany({
      where: {
        swipedId: req.user!.id,
        direction: 'RIGHT',
        // Exclude users we've already swiped on
        swiper: {
          receivedSwipes: {
            none: {
              swiperId: req.user!.id,
            },
          },
        },
      },
      include: {
        swiper: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const profiles = likes.map(like => ({
      id: like.swiper.id,
      display_name: like.swiper.displayName,
      profile_photo: like.swiper.profilePhoto,
      is_super_like: like.isSuperLike,
      liked_at: like.createdAt,
    }));

    res.json({ profiles, count: profiles.length });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Daily Limits
// =============================================================================

// Get daily limits status
router.get('/limits', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limits = await getAllDailyLimits(req.user!.id);

    res.json({
      tier: limits.tier,
      swipes: {
        used: limits.swipes.used,
        limit: limits.swipes.isUnlimited ? null : limits.swipes.limit,
        remaining: limits.swipes.isUnlimited ? null : limits.swipes.remaining,
        is_unlimited: limits.swipes.isUnlimited,
        resets_at: limits.swipes.resetsAt.toISOString(),
      },
      messages: {
        used: limits.messages.used,
        limit: limits.messages.isUnlimited ? null : limits.messages.limit,
        remaining: limits.messages.isUnlimited ? null : limits.messages.remaining,
        is_unlimited: limits.messages.isUnlimited,
        resets_at: limits.messages.resetsAt.toISOString(),
      },
      super_likes: {
        used: limits.superLikes.used,
        limit: limits.superLikes.isUnlimited ? null : limits.superLikes.limit,
        remaining: limits.superLikes.isUnlimited ? null : limits.superLikes.remaining,
        is_unlimited: limits.superLikes.isUnlimited,
        resets_at: limits.superLikes.resetsAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Helpers
// =============================================================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default router;

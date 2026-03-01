import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { adminActionRateLimit } from '../middleware/rateLimit.js';
import * as push from '../services/push.js';
import * as cache from '../services/cache.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Cache TTL for admin stats (5 minutes)
const ADMIN_STATS_CACHE_TTL = 300;

// CODE-002: Proper type definition for admin dashboard stats
interface AdminDashboardStats {
  users: {
    total: number;
    new_today: number;
    new_week: number;
    active_today: number;
  };
  matches: {
    total: number;
    today: number;
  };
  couples: {
    total: number;
  };
  moderation: {
    pending_verifications: number;
    pending_reports: number;
  };
  revenue: {
    total: number;
  };
  generated_at: string;
}

// PERF-010: Pagination limits
const ADMIN_DEFAULT_PAGE_SIZE = 20;
const ADMIN_MAX_PAGE_SIZE = 50;

// =============================================================================
// Admin Middleware
// =============================================================================

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return next(new AppError(403, 'Admin access required'));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireModerator(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true },
    });

    if (!user || !['ADMIN', 'MODERATOR'].includes(user.role)) {
      return next(new AppError(403, 'Moderator access required'));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

// =============================================================================
// Dashboard & Analytics
// =============================================================================

// GET /admin/stats - Dashboard statistics
router.get('/stats', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    // Try to get from cache first
    const cacheKey = 'admin:dashboard:stats';
    // CODE-002: Use proper type instead of any
    const cachedStats = await cache.get<AdminDashboardStats>(cacheKey);

    if (cachedStats) {
      res.json({ ...cachedStats, cached: true });
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      activeUsersToday,
      totalMatches,
      matchesToday,
      totalCouples,
      pendingVerifications,
      pendingReports,
      totalRevenue,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { lastActive: { gte: today } } }),
      prisma.match.count(),
      prisma.match.count({ where: { matchedAt: { gte: today } } }),
      prisma.couple.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    const stats = {
      users: {
        total: totalUsers,
        new_today: newUsersToday,
        new_week: newUsersWeek,
        active_today: activeUsersToday,
      },
      matches: {
        total: totalMatches,
        today: matchesToday,
      },
      couples: {
        total: totalCouples,
      },
      moderation: {
        pending_verifications: pendingVerifications,
        pending_reports: pendingReports,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
      },
      generated_at: new Date().toISOString(),
    };

    // Cache the stats for 5 minutes
    await cache.set(cacheKey, stats, ADMIN_STATS_CACHE_TTL);

    res.json({ ...stats, cached: false });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// User Management
// =============================================================================

// GET /admin/users - List users with pagination & filters
router.get('/users', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = String(ADMIN_DEFAULT_PAGE_SIZE), search, status, role, verified } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(parseInt(limit as string) || ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE);
    const skip = (pageNum - 1) * limitNum;

    // CODE-003: Use proper Prisma where type instead of any
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { displayName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.accountStatus = status as string;
    }

    if (role) {
      where.role = role as string;
    }

    if (verified === 'true') {
      where.verified = true;
    } else if (verified === 'false') {
      where.verified = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          profilePhoto: true,
          role: true,
          verified: true,
          verificationStatus: true,
          accountStatus: true,
          isOnline: true,
          lastActive: true,
          createdAt: true,
          subscriptionTier: true,
          _count: {
            select: {
              reports: true,
              sentMessages: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        display_name: u.displayName,
        profile_photo: u.profilePhoto,
        role: u.role,
        verified: u.verified,
        verification_status: u.verificationStatus,
        account_status: u.accountStatus,
        is_online: u.isOnline,
        last_active: u.lastActive,
        created_at: u.createdAt,
        subscription_tier: u.subscriptionTier,
        report_count: u._count.reports,
        message_count: u._count.sentMessages,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/users/:userId - Get user details
router.get('/users/:userId', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
        photos: true,
        reports: {
          include: {
            reporter: {
              select: { id: true, displayName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            matchesAsUser1: true,
            matchesAsUser2: true,
            sentMessages: true,
            stories: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        bio: user.bio,
        profile_photo: user.profilePhoto,
        photos: user.photos,
        role: user.role,
        verified: user.verified,
        verification_status: user.verificationStatus,
        verification_photo_url: user.verificationPhotoUrl,
        account_status: user.accountStatus,
        is_online: user.isOnline,
        last_active: user.lastActive,
        created_at: user.createdAt,
        subscription_tier: user.subscriptionTier,
        subscription_expires: user.subscriptionExpiresAt,
        profile: user.profile,
        preferences: user.preferences,
        stats: {
          matches: user._count.matchesAsUser1 + user._count.matchesAsUser2,
          messages: user._count.sentMessages,
          stories: user._count.stories,
        },
        recent_reports: user.reports,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:userId/ban - Ban user
// SEC-009: Rate limited to prevent abuse
router.post('/users/:userId/ban', authenticate, adminActionRateLimit, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;
    const { reason, duration_days } = req.body;

    const bannedUntil = duration_days
      ? new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'BANNED',
        bannedAt: new Date(),
        bannedUntil,
        banReason: reason,
        bannedBy: req.user!.id,
      },
    });

    // Log action
    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'BAN_USER',
        targetType: 'USER',
        targetId: userId,
        reason,
        metadata: { duration_days },
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:userId/unban - Unban user
// SEC-009: Rate limited to prevent abuse
router.post('/users/:userId/unban', authenticate, adminActionRateLimit, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;

    await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'ACTIVE',
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
      },
    });

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'UNBAN_USER',
        targetType: 'USER',
        targetId: userId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /admin/users/:userId/warn - Warn user
// SEC-009: Rate limited to prevent abuse
router.post('/users/:userId/warn', authenticate, adminActionRateLimit, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;
    const { reason, message } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { warningCount: { increment: 1 } },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Account Warning',
        body: message || 'Your account has received a warning for policy violations.',
      },
    });

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'WARN_USER',
        targetType: 'USER',
        targetId: userId,
        reason,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Verification Management
// =============================================================================

// GET /admin/verifications - List pending verifications
router.get('/verifications', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { status = 'PENDING', page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    // CODE-003: Use proper Prisma where type instead of any
    const where: Prisma.UserWhereInput = {};
    if (status) {
      where.verificationStatus = status as string;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { verificationSubmittedAt: 'asc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          profilePhoto: true,
          verificationStatus: true,
          verificationPhotoUrl: true,
          verificationSubmittedAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      verifications: users.map(u => ({
        user_id: u.id,
        email: u.email,
        display_name: u.displayName,
        profile_photo: u.profilePhoto,
        verification_photo: u.verificationPhotoUrl,
        status: u.verificationStatus,
        submitted_at: u.verificationSubmittedAt,
        created_at: u.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/verifications/:userId/approve - Approve verification
router.post('/verifications/:userId/approve', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;

    await prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: req.user!.id,
      },
    });

    // Notify user
    push.sendVerificationNotification(userId, 'approved')
      .catch(err => logger.error('Push notification failed:', { error: err.message }));

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'APPROVE_VERIFICATION',
        targetType: 'USER',
        targetId: userId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /admin/verifications/:userId/reject - Reject verification
router.post('/verifications/:userId/reject', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: 'REJECTED',
        verificationRejectedReason: reason,
      },
    });

    // Notify user
    push.sendVerificationNotification(userId, 'rejected')
      .catch(err => logger.error('Push notification failed:', { error: err.message }));

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'REJECT_VERIFICATION',
        targetType: 'USER',
        targetId: userId,
        reason,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Report Management
// =============================================================================

// GET /admin/reports - List reports
router.get('/reports', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { status = 'PENDING', type, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.reportType = type;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: { id: true, displayName: true, email: true },
          },
          reported: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      reports: reports.map(r => ({
        id: r.id,
        reporter: r.reporter,
        reported: r.reported,
        type: r.reportType,
        reason: r.reason,
        description: r.description,
        evidence_urls: r.evidenceUrls,
        status: r.status,
        created_at: r.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/reports/:reportId/resolve - Resolve report
router.post('/reports/:reportId/resolve', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { reportId } = req.params;
    const { action, notes } = req.body;
    // action: 'DISMISSED', 'WARNING_ISSUED', 'USER_BANNED', 'CONTENT_REMOVED'

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'RESOLVED',
        resolution: action,
        resolutionNotes: notes,
        resolvedAt: new Date(),
        resolvedBy: req.user!.id,
      },
    });

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'RESOLVE_REPORT',
        targetType: 'REPORT',
        targetId: reportId,
        metadata: { action, notes },
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Content Management
// =============================================================================

// GET /admin/stories - List reported/flagged stories
router.get('/stories', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { flagged = 'true', page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (flagged === 'true') {
      where.isFlagged = true;
    }

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      prisma.story.count({ where }),
    ]);

    res.json({
      stories: stories.map(s => ({
        id: s.id,
        user: s.user,
        media_type: s.mediaType,
        media_url: s.mediaUrl,
        text: s.text,
        is_flagged: s.isFlagged,
        flag_reason: s.flagReason,
        view_count: s.viewCount,
        created_at: s.createdAt,
        expires_at: s.expiresAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/stories/:storyId - Remove story
router.delete('/stories/:storyId', authenticate, requireModerator, async (req: AuthRequest, res, next) => {
  try {
    const { storyId } = req.params;
    const { reason } = req.body;

    const story = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new AppError(404, 'Story not found');
    }

    await prisma.story.delete({ where: { id: storyId } });

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'REMOVE_CONTENT',
        targetType: 'STORY',
        targetId: storyId,
        reason,
        metadata: { user_id: story.userId },
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Admin Action Log
// =============================================================================

// GET /admin/actions - Get admin action log
router.get('/actions', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { admin_id, action, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const skip = (pageNum - 1) * limitNum;

    // CODE-003: Use proper Prisma where type instead of any
    const where: Prisma.AdminActionWhereInput = {};
    if (admin_id) where.adminId = admin_id as string;
    if (action) where.action = action as string;

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      prisma.adminAction.count({ where }),
    ]);

    res.json({
      actions: actions.map(a => ({
        id: a.id,
        admin: a.admin,
        action: a.action,
        target_type: a.targetType,
        target_id: a.targetId,
        reason: a.reason,
        metadata: a.metadata,
        created_at: a.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// System Management (Admin only)
// =============================================================================

// POST /admin/broadcast - Send broadcast notification
router.post('/broadcast', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { title, body, target_role } = req.body;

    // Get target users
    // CODE-003: Use proper Prisma where type instead of any
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (target_role) {
      where.role = target_role as string;
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });

    // Create notifications for all users
    await prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        type: 'SYSTEM',
        title,
        body,
      })),
    });

    // Send push notifications
    push.sendPushToMultipleUsers(
      users.map(u => u.id),
      { title, body }
    ).catch(err => logger.error('Broadcast push failed:', { error: err.message }));

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: 'BROADCAST',
        targetType: 'SYSTEM',
        targetId: 'all',
        metadata: { title, body, target_role, user_count: users.length },
      },
    });

    res.json({ success: true, sent_to: users.length });
  } catch (error) {
    next(error);
  }
});

// GET /admin/system/health - System health check
router.get('/system/health', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    // Check database
    const dbHealth = await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth ? 'connected' : 'disconnected',
      },
    });
  } catch (error) {
    res.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
});

export default router;

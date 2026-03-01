import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// =============================================================================
// AI Content Moderation Service (placeholder for actual AI integration)
// =============================================================================

interface ModerationResult {
  flagged: boolean;
  confidence: number;
  categories: string[];
  suggestedAction: 'ALLOW' | 'REVIEW' | 'BLOCK';
}

async function moderateContent(content: string, contentType: string): Promise<ModerationResult> {
  // Placeholder for AI moderation - in production, integrate with:
  // - OpenAI Moderation API
  // - AWS Rekognition (for images)
  // - Google Cloud Vision
  // - Azure Content Moderator

  const lowerContent = content.toLowerCase();

  // Simple keyword-based detection (replace with actual AI)
  const harmfulPatterns = [
    { pattern: /\b(kill|murder|violence)\b/i, category: 'violence' },
    { pattern: /\b(nude|naked|explicit)\b/i, category: 'sexual' },
    { pattern: /\b(scam|wire|send money)\b/i, category: 'scam' },
    { pattern: /\b(hate|racist|slur)\b/i, category: 'hate_speech' },
    { pattern: /\b(underage|minor)\b/i, category: 'child_safety' },
  ];

  const detectedCategories: string[] = [];

  for (const { pattern, category } of harmfulPatterns) {
    if (pattern.test(lowerContent)) {
      detectedCategories.push(category);
    }
  }

  const flagged = detectedCategories.length > 0;
  const confidence = flagged ? 0.7 + Math.random() * 0.25 : 0.1;

  let suggestedAction: 'ALLOW' | 'REVIEW' | 'BLOCK' = 'ALLOW';
  if (detectedCategories.includes('child_safety')) {
    suggestedAction = 'BLOCK';
  } else if (flagged) {
    suggestedAction = confidence > 0.85 ? 'BLOCK' : 'REVIEW';
  }

  return { flagged, confidence, categories: detectedCategories, suggestedAction };
}

async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  // Placeholder for image moderation
  // In production, use AWS Rekognition, Google Vision, etc.
  return {
    flagged: false,
    confidence: 0.1,
    categories: [],
    suggestedAction: 'ALLOW',
  };
}

// =============================================================================
// Moderate Text Content
// =============================================================================

router.post('/check-text', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { content, content_type = 'message' } = req.body;

    if (!content || typeof content !== 'string') {
      throw new AppError(400, 'Content required');
    }

    const result = await moderateContent(content, content_type);

    // Log flagged content for review
    if (result.flagged) {
      await prisma.contentFlag.create({
        data: {
          contentType: content_type.toUpperCase() as any,
          contentId: `text_${Date.now()}`, // Would be actual content ID in production
          reporterId: req.user!.id,
          source: 'AI',
          confidence: result.confidence,
          categories: result.categories,
          status: result.suggestedAction === 'BLOCK' ? 'ACTIONED' : 'PENDING',
        },
      });
    }

    res.json({
      allowed: result.suggestedAction !== 'BLOCK',
      flagged: result.flagged,
      categories: result.categories,
      confidence: result.confidence,
      action: result.suggestedAction,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Moderate Image Content
// =============================================================================

router.post('/check-image', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { image_url, content_type = 'photo' } = req.body;

    if (!image_url) {
      throw new AppError(400, 'Image URL required');
    }

    const result = await moderateImage(image_url);

    if (result.flagged) {
      await prisma.contentFlag.create({
        data: {
          contentType: content_type.toUpperCase() as any,
          contentId: `image_${Date.now()}`,
          reporterId: req.user!.id,
          source: 'AI',
          confidence: result.confidence,
          categories: result.categories,
          status: result.suggestedAction === 'BLOCK' ? 'ACTIONED' : 'PENDING',
        },
      });
    }

    res.json({
      allowed: result.suggestedAction !== 'BLOCK',
      flagged: result.flagged,
      categories: result.categories,
      confidence: result.confidence,
      action: result.suggestedAction,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Report Content (User-initiated)
// =============================================================================

router.post('/report', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { content_type, content_id, reason, details } = req.body;

    if (!content_type || !content_id || !reason) {
      throw new AppError(400, 'Content type, ID, and reason required');
    }

    const validReasons = [
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'sexual_content',
      'scam',
      'impersonation',
      'other',
    ];

    if (!validReasons.includes(reason)) {
      throw new AppError(400, 'Invalid report reason');
    }

    // Check for duplicate report
    const existingReport = await prisma.contentFlag.findFirst({
      where: {
        contentType: content_type.toUpperCase(),
        contentId: content_id,
        reporterId: req.user!.id,
        source: 'USER',
      },
    });

    if (existingReport) {
      throw new AppError(409, 'You have already reported this content');
    }

    const flag = await prisma.contentFlag.create({
      data: {
        contentType: content_type.toUpperCase() as any,
        contentId: content_id,
        reporterId: req.user!.id,
        source: 'USER',
        categories: [reason],
        details: details || null,
        status: 'PENDING',
      },
    });

    // Check if content has multiple reports
    const reportCount = await prisma.contentFlag.count({
      where: {
        contentType: content_type.toUpperCase(),
        contentId: content_id,
        status: 'PENDING',
      },
    });

    // Auto-escalate if multiple reports
    if (reportCount >= 3) {
      await prisma.contentFlag.updateMany({
        where: {
          contentType: content_type.toUpperCase(),
          contentId: content_id,
          status: 'PENDING',
        },
        data: {
          status: 'ESCALATED',
        },
      });
    }

    res.json({
      success: true,
      report_id: flag.id,
      message: 'Thank you for your report. We will review it shortly.',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get My Reports
// =============================================================================

router.get('/my-reports', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const reports = await prisma.contentFlag.findMany({
      where: {
        reporterId: req.user!.id,
        source: 'USER',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      reports: reports.map(r => ({
        id: r.id,
        content_type: r.contentType,
        content_id: r.contentId,
        categories: r.categories,
        status: r.status,
        created_at: r.createdAt,
        resolved_at: r.resolvedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Admin: Get Pending Flags
// =============================================================================

router.get('/admin/pending', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Check admin status
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      throw new AppError(403, 'Admin access required');
    }

    const { status = 'PENDING', limit = '50', offset = '0' } = req.query;

    const flags = await prisma.contentFlag.findMany({
      where: {
        status: status as any,
      },
      orderBy: [
        { confidence: 'desc' },
        { createdAt: 'asc' },
      ],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.contentFlag.count({
      where: { status: status as any },
    });

    res.json({
      flags: flags.map(f => ({
        id: f.id,
        content_type: f.contentType,
        content_id: f.contentId,
        source: f.source,
        confidence: f.confidence,
        categories: f.categories,
        details: f.details,
        status: f.status,
        created_at: f.createdAt,
      })),
      total,
      has_more: parseInt(offset as string) + flags.length < total,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Admin: Resolve Flag
// =============================================================================

router.post('/admin/resolve/:flagId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { flagId } = req.params;
    const { action, notes } = req.body;

    // Check admin status
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      throw new AppError(403, 'Admin access required');
    }

    if (!['DISMISSED', 'ACTIONED'].includes(action)) {
      throw new AppError(400, 'Invalid action');
    }

    const flag = await prisma.contentFlag.update({
      where: { id: flagId },
      data: {
        status: action,
        reviewerId: req.user!.id,
        reviewNotes: notes,
        resolvedAt: new Date(),
      },
    });

    // If actioned, take appropriate action on the content
    if (action === 'ACTIONED') {
      // In production, this would:
      // - Delete/hide the content
      // - Warn/suspend the user
      // - Log the action
      console.log(`Content ${flag.contentType}:${flag.contentId} actioned by moderator`);
    }

    res.json({
      success: true,
      flag_id: flag.id,
      new_status: flag.status,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Admin: Get Moderation Stats
// =============================================================================

router.get('/admin/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      throw new AppError(403, 'Admin access required');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalPending,
      totalEscalated,
      todayFlags,
      aiFlags,
      userReports,
      actionedToday,
    ] = await Promise.all([
      prisma.contentFlag.count({ where: { status: 'PENDING' } }),
      prisma.contentFlag.count({ where: { status: 'ESCALATED' } }),
      prisma.contentFlag.count({ where: { createdAt: { gte: today } } }),
      prisma.contentFlag.count({ where: { source: 'AI' } }),
      prisma.contentFlag.count({ where: { source: 'USER' } }),
      prisma.contentFlag.count({
        where: {
          status: 'ACTIONED',
          resolvedAt: { gte: today },
        },
      }),
    ]);

    // Category breakdown
    const categoryBreakdown = await prisma.contentFlag.groupBy({
      by: ['categories'],
      _count: true,
      where: { status: 'PENDING' },
    });

    res.json({
      queue: {
        pending: totalPending,
        escalated: totalEscalated,
      },
      today: {
        new_flags: todayFlags,
        resolved: actionedToday,
      },
      sources: {
        ai_detected: aiFlags,
        user_reported: userReports,
      },
      categories: categoryBreakdown,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// =============================================================================
// Scam Detection Patterns
// =============================================================================

interface ScamIndicator {
  type: string;
  pattern: RegExp;
  weight: number;
  description: string;
}

const SCAM_INDICATORS: ScamIndicator[] = [
  // Financial requests
  { type: 'FINANCIAL', pattern: /\b(send|wire|transfer)\s+(me\s+)?(money|\$|dollars|cash)\b/i, weight: 0.4, description: 'Direct money request' },
  { type: 'FINANCIAL', pattern: /\b(gift\s*card|crypto|bitcoin|western\s*union|money\s*gram)\b/i, weight: 0.35, description: 'Untraceable payment method' },
  { type: 'FINANCIAL', pattern: /\b(bank\s*account|routing\s*number|social\s*security)\b/i, weight: 0.45, description: 'Sensitive financial info request' },

  // Urgency tactics
  { type: 'URGENCY', pattern: /\b(emergency|urgent|immediately|right\s*now|asap)\b/i, weight: 0.15, description: 'Urgency language' },
  { type: 'URGENCY', pattern: /\b(hospital|accident|stranded|stuck)\b/i, weight: 0.2, description: 'Emergency scenario' },
  { type: 'URGENCY', pattern: /\b(dying|surgery|medical)\s*(bill|expense|emergency)\b/i, weight: 0.3, description: 'Medical emergency claim' },

  // Romance scam patterns
  { type: 'ROMANCE', pattern: /\b(love\s*you|marry|soulmate)\b/i, weight: 0.1, description: 'Fast emotional escalation' },
  { type: 'ROMANCE', pattern: /\b(military|deployed|overseas|oil\s*rig)\b/i, weight: 0.25, description: 'Common scam profession claim' },
  { type: 'ROMANCE', pattern: /\b(widow|widower|lost\s*my\s*(wife|husband))\b/i, weight: 0.15, description: 'Sympathy-building story' },

  // Identity red flags
  { type: 'IDENTITY', pattern: /\b(can't\s*video|camera\s*broken|no\s*webcam)\b/i, weight: 0.2, description: 'Avoiding video verification' },
  { type: 'IDENTITY', pattern: /\b(don't\s*tell\s*anyone|keep\s*this\s*secret|between\s*us)\b/i, weight: 0.25, description: 'Secrecy request' },

  // External platform requests
  { type: 'PLATFORM', pattern: /\b(whatsapp|telegram|signal|hangouts|kik)\b/i, weight: 0.1, description: 'Moving off platform' },
  { type: 'PLATFORM', pattern: /\b(email\s*me|text\s*me\s*at|call\s*me\s*at)\b/i, weight: 0.1, description: 'Moving to private channel' },

  // Investment scams
  { type: 'INVESTMENT', pattern: /\b(investment|forex|trading|crypto)\s*(opportunity|profit|returns)\b/i, weight: 0.35, description: 'Investment opportunity pitch' },
  { type: 'INVESTMENT', pattern: /\b(guaranteed|double|triple)\s*(your\s*)?(money|investment|returns)\b/i, weight: 0.4, description: 'Unrealistic return promise' },
];

// =============================================================================
// Analyze Message for Scam Indicators
// =============================================================================

interface ScamAnalysisResult {
  isRisky: boolean;
  riskScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  indicators: Array<{ type: string; description: string; weight: number }>;
  recommendation: string;
}

function analyzeMessageForScam(content: string): ScamAnalysisResult {
  const detectedIndicators: Array<{ type: string; description: string; weight: number }> = [];
  let totalWeight = 0;

  for (const indicator of SCAM_INDICATORS) {
    if (indicator.pattern.test(content)) {
      detectedIndicators.push({
        type: indicator.type,
        description: indicator.description,
        weight: indicator.weight,
      });
      totalWeight += indicator.weight;
    }
  }

  // Calculate risk score (0-1)
  const riskScore = Math.min(totalWeight, 1);

  // Determine severity
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (riskScore >= 0.7) severity = 'CRITICAL';
  else if (riskScore >= 0.5) severity = 'HIGH';
  else if (riskScore >= 0.3) severity = 'MEDIUM';

  // Generate recommendation
  let recommendation = 'No concerning patterns detected.';
  if (severity === 'CRITICAL') {
    recommendation = 'This message shows multiple strong scam indicators. Do not send money or share personal information.';
  } else if (severity === 'HIGH') {
    recommendation = 'This message contains concerning patterns. Be cautious and verify the person\'s identity.';
  } else if (severity === 'MEDIUM') {
    recommendation = 'Some potentially concerning language detected. Proceed with caution.';
  }

  return {
    isRisky: riskScore >= 0.3,
    riskScore,
    severity,
    indicators: detectedIndicators,
    recommendation,
  };
}

// =============================================================================
// Analyze Conversation (Called on message receive)
// =============================================================================

router.post('/analyze-message', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { message_content, sender_id, conversation_id } = req.body;

    if (!message_content) {
      throw new AppError(400, 'Message content required');
    }

    const analysis = analyzeMessageForScam(message_content);

    // If risky, create an alert
    if (analysis.isRisky) {
      await prisma.scamAlert.create({
        data: {
          userId: req.user!.id,
          reportedUserId: sender_id,
          alertType: analysis.indicators[0]?.type as any || 'OTHER',
          severity: analysis.severity,
          confidence: analysis.riskScore,
          indicators: analysis.indicators.map(i => i.description),
          evidence: {
            message_preview: message_content.substring(0, 200),
            conversation_id,
            analyzed_at: new Date().toISOString(),
          },
          status: analysis.severity === 'CRITICAL' ? 'ESCALATED' : 'ACTIVE',
        },
      });
    }

    res.json({
      risk_detected: analysis.isRisky,
      risk_score: analysis.riskScore,
      severity: analysis.severity,
      indicators: analysis.indicators,
      recommendation: analysis.recommendation,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get User's Scam Alerts
// =============================================================================

router.get('/my-alerts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const alerts = await prisma.scamAlert.findMany({
      where: {
        userId: req.user!.id,
        status: { in: ['ACTIVE', 'ESCALATED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      alerts: alerts.map(a => ({
        id: a.id,
        type: a.alertType,
        severity: a.severity,
        indicators: a.indicators,
        recommendation: getRecommendation(a.alertType, a.severity),
        created_at: a.createdAt,
      })),
      has_critical: alerts.some(a => a.severity === 'CRITICAL'),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Dismiss Alert
// =============================================================================

router.post('/dismiss/:alertId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { alertId } = req.params;

    const alert = await prisma.scamAlert.findFirst({
      where: {
        id: alertId,
        userId: req.user!.id,
      },
    });

    if (!alert) {
      throw new AppError(404, 'Alert not found');
    }

    await prisma.scamAlert.update({
      where: { id: alertId },
      data: {
        status: 'DISMISSED',
        resolvedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Report Scam (User-initiated)
// =============================================================================

router.post('/report', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { reported_user_id, alert_type, description, evidence } = req.body;

    if (!reported_user_id || !alert_type) {
      throw new AppError(400, 'Reported user and alert type required');
    }

    const validTypes = ['ROMANCE_SCAM', 'FINANCIAL_REQUEST', 'IDENTITY_FRAUD', 'INVESTMENT_SCAM', 'OTHER'];
    if (!validTypes.includes(alert_type)) {
      throw new AppError(400, 'Invalid alert type');
    }

    // Create high-severity alert from user report
    const alert = await prisma.scamAlert.create({
      data: {
        userId: req.user!.id,
        reportedUserId: reported_user_id,
        alertType: alert_type,
        severity: 'HIGH',
        confidence: 1.0, // User-reported, so high confidence
        indicators: description ? [description] : ['User-reported scam'],
        evidence: evidence || {},
        status: 'ESCALATED', // User reports go straight to review
      },
    });

    // Check if reported user has multiple reports
    const reportCount = await prisma.scamAlert.count({
      where: {
        reportedUserId: reported_user_id,
        status: { in: ['ACTIVE', 'ESCALATED'] },
      },
    });

    // Auto-flag user if multiple reports
    if (reportCount >= 3) {
      await prisma.user.update({
        where: { id: reported_user_id },
        data: {
          // In production, add a flaggedForReview field
          // flaggedForReview: true,
        },
      });
    }

    res.json({
      success: true,
      alert_id: alert.id,
      message: 'Thank you for reporting. Our safety team will investigate.',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get Safety Tips
// =============================================================================

router.get('/safety-tips', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tips = [
      {
        category: 'Financial Safety',
        tips: [
          'Never send money to someone you haven\'t met in person',
          'Be wary of sob stories requesting financial help',
          'Gift cards, crypto, and wire transfers are untraceable - scammers love them',
          'If it sounds too good to be true, it probably is',
        ],
      },
      {
        category: 'Identity Verification',
        tips: [
          'Video chat before meeting to verify identity',
          'Reverse image search profile photos',
          'Be cautious if they always have excuses not to video call',
          'Verify stories independently - don\'t just take their word',
        ],
      },
      {
        category: 'Red Flags',
        tips: [
          'Professing love very quickly (love bombing)',
          'Claims to be military, doctor, or working overseas',
          'Always has emergencies that require money',
          'Wants to move off the platform immediately',
          'Asks you to keep the relationship secret',
        ],
      },
      {
        category: 'Staying Safe',
        tips: [
          'Meet in public places for first dates',
          'Tell a friend where you\'re going',
          'Trust your instincts - if something feels off, it probably is',
          'Report suspicious behavior to help protect others',
        ],
      },
    ];

    res.json({ tips });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Admin: Get Scam Alert Dashboard
// =============================================================================

router.get('/admin/dashboard', authenticate, async (req: AuthRequest, res, next) => {
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

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const [
      activeAlerts,
      escalatedAlerts,
      alertsToday,
      alertsThisWeek,
      byType,
      bySeverity,
      topReportedUsers,
    ] = await Promise.all([
      prisma.scamAlert.count({ where: { status: 'ACTIVE' } }),
      prisma.scamAlert.count({ where: { status: 'ESCALATED' } }),
      prisma.scamAlert.count({ where: { createdAt: { gte: today } } }),
      prisma.scamAlert.count({ where: { createdAt: { gte: thisWeek } } }),
      prisma.scamAlert.groupBy({
        by: ['alertType'],
        _count: true,
        where: { status: { in: ['ACTIVE', 'ESCALATED'] } },
      }),
      prisma.scamAlert.groupBy({
        by: ['severity'],
        _count: true,
        where: { status: { in: ['ACTIVE', 'ESCALATED'] } },
      }),
      prisma.scamAlert.groupBy({
        by: ['reportedUserId'],
        _count: true,
        where: {
          status: { in: ['ACTIVE', 'ESCALATED'] },
          reportedUserId: { not: null },
        },
        orderBy: { _count: { reportedUserId: 'desc' } },
        take: 10,
      }),
    ]);

    res.json({
      overview: {
        active_alerts: activeAlerts,
        escalated_alerts: escalatedAlerts,
        alerts_today: alertsToday,
        alerts_this_week: alertsThisWeek,
      },
      breakdown: {
        by_type: byType.map(t => ({ type: t.alertType, count: t._count })),
        by_severity: bySeverity.map(s => ({ severity: s.severity, count: s._count })),
      },
      top_reported_users: topReportedUsers.map(u => ({
        user_id: u.reportedUserId,
        report_count: u._count,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Admin: Review Alert
// =============================================================================

router.post('/admin/review/:alertId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { alertId } = req.params;
    const { action, notes, ban_user } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      throw new AppError(403, 'Admin access required');
    }

    if (!['CONFIRMED', 'FALSE_POSITIVE', 'DISMISSED'].includes(action)) {
      throw new AppError(400, 'Invalid action');
    }

    const alert = await prisma.scamAlert.update({
      where: { id: alertId },
      data: {
        status: action === 'CONFIRMED' ? 'CONFIRMED' : 'DISMISSED',
        adminNotes: notes,
        resolvedAt: new Date(),
      },
    });

    // If confirmed scam and ban requested
    if (action === 'CONFIRMED' && ban_user && alert.reportedUserId) {
      await prisma.user.update({
        where: { id: alert.reportedUserId },
        data: {
          status: 'SUSPENDED',
          // In production, add reason, bannedAt, etc.
        },
      });

      // Notify the reporter
      await prisma.notification.create({
        data: {
          userId: alert.userId,
          type: 'SYSTEM',
          title: 'Report Resolved',
          body: 'Thank you for your report. We have taken action against the reported user.',
        },
      });
    }

    res.json({
      success: true,
      alert_id: alert.id,
      status: alert.status,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function getRecommendation(alertType: string, severity: string): string {
  const recommendations: Record<string, string> = {
    ROMANCE_SCAM: 'Be cautious of fast emotional connections. Verify identity through video chat.',
    FINANCIAL_REQUEST: 'Never send money to someone you haven\'t met in person.',
    IDENTITY_FRAUD: 'Request video verification before continuing the relationship.',
    INVESTMENT_SCAM: 'Legitimate investments don\'t guarantee returns. Research thoroughly.',
    PHISHING: 'Never share passwords or click suspicious links.',
    OTHER: 'Trust your instincts. If something feels wrong, it probably is.',
  };

  let base = recommendations[alertType] || recommendations.OTHER;

  if (severity === 'CRITICAL') {
    base = '⚠️ HIGH RISK: ' + base + ' Consider blocking this user.';
  }

  return base;
}

export default router;

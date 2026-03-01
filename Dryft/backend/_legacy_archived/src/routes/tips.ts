import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { TIP_AMOUNTS, createTipPayment, getOrCreateCustomer } from '../services/stripe.js';
import * as push from '../services/push.js';

const router = Router();

// =============================================================================
// Schemas
// =============================================================================

const sendTipSchema = z.object({
  recipient_id: z.string().uuid(),
  amount: z.number().min(100).max(100000), // $1 - $1000
  message: z.string().max(200).optional(),
  is_anonymous: z.boolean().optional(),
  payment_method_id: z.string(),
});

// =============================================================================
// Get Tip Amounts
// =============================================================================

router.get('/amounts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({
      amounts: TIP_AMOUNTS.map(t => ({
        id: t.id,
        amount: t.amount,
        label: t.label,
        is_custom: t.id === 'tip_custom',
      })),
      platform_fee_percent: 10,
      min_amount: 100, // $1
      max_amount: 100000, // $1000
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Send Tip
// =============================================================================

router.post('/send', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = sendTipSchema.parse(req.body);

    // Can't tip yourself
    if (data.recipient_id === req.user!.id) {
      throw new AppError(400, 'Cannot tip yourself');
    }

    // Get recipient
    const recipient = await prisma.user.findUnique({
      where: { id: data.recipient_id },
      select: {
        id: true,
        displayName: true,
        isCreator: true,
        stripeConnectId: true,
      },
    });

    if (!recipient) {
      throw new AppError(404, 'Recipient not found');
    }

    // Recipient must be a creator with Stripe Connect
    if (!recipient.isCreator || !recipient.stripeConnectId) {
      throw new AppError(400, 'Recipient is not set up to receive tips');
    }

    // Get sender
    const sender = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true, displayName: true },
    });

    // Create payment intent
    const paymentIntent = await createTipPayment({
      senderId: req.user!.id,
      senderEmail: sender!.email,
      recipientId: recipient.id,
      recipientConnectId: recipient.stripeConnectId,
      amount: data.amount,
      message: data.message,
    });

    // Create tip record
    const tip = await prisma.tip.create({
      data: {
        senderId: req.user!.id,
        recipientId: recipient.id,
        amount: data.amount,
        message: data.message,
        isAnonymous: data.is_anonymous || false,
        stripePaymentId: paymentIntent.id,
        status: 'PENDING',
      },
    });

    res.json({
      tip_id: tip.id,
      client_secret: paymentIntent.client_secret,
      amount: data.amount,
      recipient: {
        id: recipient.id,
        display_name: recipient.displayName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Confirm Tip (after payment)
// =============================================================================

router.post('/:tipId/confirm', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { tipId } = req.params;

    const tip = await prisma.tip.findUnique({
      where: { id: tipId },
      include: {
        // We need to manually query since we don't have relations defined
      },
    });

    if (!tip || tip.senderId !== req.user!.id) {
      throw new AppError(404, 'Tip not found');
    }

    if (tip.status !== 'PENDING') {
      throw new AppError(400, 'Tip already processed');
    }

    // Update tip status
    await prisma.tip.update({
      where: { id: tipId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Get sender info for notification
    const sender = await prisma.user.findUnique({
      where: { id: tip.senderId },
      select: { displayName: true },
    });

    // Notify recipient
    const senderName = tip.isAnonymous ? 'Someone' : (sender?.displayName || 'Someone');
    await prisma.notification.create({
      data: {
        userId: tip.recipientId,
        type: 'GIFT_RECEIVED',
        title: 'You received a tip!',
        body: `${senderName} sent you $${(tip.amount / 100).toFixed(2)}${tip.message ? `: "${tip.message}"` : ''}`,
        data: { tipId: tip.id, amount: tip.amount },
      },
    });

    // Send push notification
    push.sendNotification(
      tip.recipientId,
      'You received a tip!',
      `${senderName} sent you $${(tip.amount / 100).toFixed(2)}`,
      { type: 'tip', tipId: tip.id }
    ).catch(console.error);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get Sent Tips
// =============================================================================

router.get('/sent', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const tips = await prisma.tip.findMany({
      where: { senderId: req.user!.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // Get recipient info
    const recipientIds = [...new Set(tips.map(t => t.recipientId))];
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, displayName: true, profilePhoto: true },
    });

    const recipientMap = new Map(recipients.map(r => [r.id, r]));

    res.json({
      tips: tips.map(t => ({
        id: t.id,
        amount: t.amount,
        message: t.message,
        recipient: recipientMap.get(t.recipientId),
        created_at: t.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get Received Tips
// =============================================================================

router.get('/received', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const tips = await prisma.tip.findMany({
      where: { recipientId: req.user!.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // Get sender info (only for non-anonymous)
    const senderIds = tips.filter(t => !t.isAnonymous).map(t => t.senderId);
    const senders = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, displayName: true, profilePhoto: true },
    });

    const senderMap = new Map(senders.map(s => [s.id, s]));

    res.json({
      tips: tips.map(t => ({
        id: t.id,
        amount: t.amount,
        message: t.message,
        is_anonymous: t.isAnonymous,
        sender: t.isAnonymous ? null : senderMap.get(t.senderId),
        created_at: t.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get Tip Stats (for creators)
// =============================================================================

router.get('/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isCreator: true },
    });

    if (!user?.isCreator) {
      throw new AppError(403, 'Must be a creator to view tip stats');
    }

    // Get this month's tips
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [allTimeTips, monthlyTips, tipCount, topTippers] = await Promise.all([
      // All time total
      prisma.tip.aggregate({
        where: { recipientId: req.user!.id, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      // Monthly total
      prisma.tip.aggregate({
        where: {
          recipientId: req.user!.id,
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      // Tip count
      prisma.tip.count({
        where: { recipientId: req.user!.id, status: 'COMPLETED' },
      }),
      // Top tippers (non-anonymous)
      prisma.tip.groupBy({
        by: ['senderId'],
        where: {
          recipientId: req.user!.id,
          status: 'COMPLETED',
          isAnonymous: false,
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    // Get tipper info
    const tipperIds = topTippers.map(t => t.senderId);
    const tippers = await prisma.user.findMany({
      where: { id: { in: tipperIds } },
      select: { id: true, displayName: true, profilePhoto: true },
    });
    const tipperMap = new Map(tippers.map(t => [t.id, t]));

    res.json({
      total_all_time: allTimeTips._sum.amount || 0,
      total_this_month: monthlyTips._sum.amount || 0,
      tip_count: tipCount,
      platform_fee_percent: 10,
      earnings_all_time: Math.round((allTimeTips._sum.amount || 0) * 0.9),
      earnings_this_month: Math.round((monthlyTips._sum.amount || 0) * 0.9),
      top_supporters: topTippers.map(t => ({
        user: tipperMap.get(t.senderId),
        total_amount: t._sum.amount,
        tip_count: t._count,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

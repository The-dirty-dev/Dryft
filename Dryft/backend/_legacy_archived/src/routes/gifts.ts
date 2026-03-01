import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as push from '../services/push.js';

const router = Router();

const sendGiftSchema = z.object({
  gift_type: z.string(),
  recipient_id: z.string().uuid(),
  message: z.string().max(500).optional(),
  is_anonymous: z.boolean().optional(),
});

// Send gift
router.post('/send', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = sendGiftSchema.parse(req.body);

    const gift = await prisma.gift.create({
      data: {
        senderId: req.user!.id,
        receiverId: data.recipient_id,
        giftType: data.gift_type,
        message: data.message,
        isAnonymous: data.is_anonymous || false,
        status: 'DELIVERED',
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: data.recipient_id,
        type: 'GIFT_RECEIVED',
        title: 'New Gift!',
        body: data.is_anonymous
          ? 'Someone sent you a gift!'
          : `You received a gift!`,
        data: { gift_id: gift.id },
      },
    });

    // Send push notification
    const senderName = data.is_anonymous
      ? null
      : (await prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { displayName: true }
        }))?.displayName || null;

    push.sendGiftNotification(data.recipient_id, senderName, data.gift_type)
      .catch(err => console.error('Push notification failed:', err));

    res.status(201).json({ gift_id: gift.id });
  } catch (error) {
    next(error);
  }
});

// Get received gifts
router.get('/received', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const gifts = await prisma.gift.findMany({
      where: { receiverId: req.user!.id },
      include: {
        sender: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      gifts: gifts.map(g => ({
        id: g.id,
        gift_type: g.giftType,
        sender: g.isAnonymous ? null : g.sender,
        message: g.message,
        is_anonymous: g.isAnonymous,
        status: g.status,
        viewed_at: g.viewedAt,
        created_at: g.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Mark gift as viewed
router.post('/viewed', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { gift_id } = req.body;

    await prisma.gift.updateMany({
      where: { id: gift_id, receiverId: req.user!.id },
      data: { viewedAt: new Date(), status: 'VIEWED' },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Send thank you
router.post('/thank', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { gift_id, message } = req.body;

    const gift = await prisma.gift.findUnique({
      where: { id: gift_id },
    });

    if (!gift || gift.receiverId !== req.user!.id) {
      throw new AppError(404, 'Gift not found');
    }

    if (gift.isAnonymous || !gift.senderId) {
      throw new AppError(400, 'Cannot thank anonymous gift');
    }

    await prisma.gift.update({
      where: { id: gift_id },
      data: { thankedAt: new Date(), status: 'THANKED' },
    });

    // Create notification for sender
    await prisma.notification.create({
      data: {
        userId: gift.senderId,
        type: 'SYSTEM',
        title: 'Gift Appreciated!',
        body: message || 'Your gift was appreciated!',
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  registerPushToken,
  unregisterPushToken,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '../services/push.js';
import { prisma } from '../utils/prisma.js';

const router = Router();

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  device_id: z.string().optional(),
});

// Register push token
router.post('/token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = registerTokenSchema.parse(req.body);

    await registerPushToken({
      userId: req.user!.id,
      token: data.token,
      platform: data.platform,
      deviceId: data.device_id,
    });

    // Subscribe to default topics
    await subscribeToTopic(data.token, 'all_users');

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Unregister push token
router.delete('/token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { token } = req.body;

    if (token) {
      await unregisterPushToken(req.user!.id, token);
      await unsubscribeFromTopic(token, 'all_users');
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Update notification preferences
router.put('/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const {
      push_enabled,
      match_notif,
      message_notif,
      like_notif,
    } = req.body;

    await prisma.preferences.upsert({
      where: { userId: req.user!.id },
      update: {
        pushEnabled: push_enabled,
        matchNotif: match_notif,
        messageNotif: message_notif,
        likeNotif: like_notif,
      },
      create: {
        userId: req.user!.id,
        pushEnabled: push_enabled ?? true,
        matchNotif: match_notif ?? true,
        messageNotif: message_notif ?? true,
        likeNotif: like_notif ?? true,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get notification preferences
router.get('/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const preferences = await prisma.preferences.findUnique({
      where: { userId: req.user!.id },
      select: {
        pushEnabled: true,
        matchNotif: true,
        messageNotif: true,
        likeNotif: true,
      },
    });

    res.json({
      push_enabled: preferences?.pushEnabled ?? true,
      match_notif: preferences?.matchNotif ?? true,
      message_notif: preferences?.messageNotif ?? true,
      like_notif: preferences?.likeNotif ?? true,
    });
  } catch (error) {
    next(error);
  }
});

// Subscribe to topic
router.post('/topics/subscribe', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { token, topic } = req.body;

    if (token && topic) {
      await subscribeToTopic(token, topic);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Unsubscribe from topic
router.post('/topics/unsubscribe', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { token, topic } = req.body;

    if (token && topic) {
      await unsubscribeFromTopic(token, topic);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get notifications
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where: { userId: req.user!.id } }),
      prisma.notification.count({
        where: { userId: req.user!.id, read: false },
      }),
    ]);

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read,
        read_at: n.readAt,
        created_at: n.createdAt,
      })),
      total,
      unread_count: unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

// Mark as read
router.post('/:notificationId/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        id: req.params.notificationId,
        userId: req.user!.id,
      },
      data: { read: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark all as read
router.post('/read-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete notification
router.delete('/:notificationId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.deleteMany({
      where: {
        id: req.params.notificationId,
        userId: req.user!.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Clear all notifications
router.delete('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.user!.id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

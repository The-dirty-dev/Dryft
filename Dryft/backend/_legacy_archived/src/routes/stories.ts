import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as push from '../services/push.js';

const router = Router();

const createStorySchema = z.object({
  media_type: z.enum(['IMAGE', 'VIDEO', 'TEXT']),
  media_url: z.string().optional(),
  text: z.string().max(500).optional(),
  text_style: z.object({
    fontFamily: z.string(),
    fontSize: z.number(),
    color: z.string(),
    alignment: z.enum(['left', 'center', 'right']),
  }).optional(),
  background_color: z.string().optional(),
  stickers: z.array(z.any()).optional(),
  privacy: z.enum(['EVERYONE', 'MATCHES_ONLY', 'CLOSE_FRIENDS']).optional(),
});

// Get story feed
router.get('/feed', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();

    // Get stories from matches and followed users
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: req.user!.id },
          { user2Id: req.user!.id },
        ],
        unmatched: false,
      },
    });

    const matchedUserIds = matches.map(m =>
      m.user1Id === req.user!.id ? m.user2Id : m.user1Id
    );

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: matchedUserIds },
        expiresAt: { gt: now },
        OR: [
          { privacy: 'EVERYONE' },
          { privacy: 'MATCHES_ONLY' },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
          },
        },
        views: {
          where: { viewerId: req.user!.id },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by user
    const groups = new Map<string, any>();
    stories.forEach(story => {
      if (!groups.has(story.userId)) {
        groups.set(story.userId, {
          user_id: story.user.id,
          user_name: story.user.displayName,
          user_photo: story.user.profilePhoto,
          stories: [],
          has_unviewed: false,
          last_updated: story.createdAt,
        });
      }
      const group = groups.get(story.userId)!;
      const isViewed = story.views.length > 0;
      group.stories.push({
        id: story.id,
        media_type: story.mediaType,
        media_url: story.mediaUrl,
        thumbnail_url: story.thumbnailUrl,
        text: story.text,
        view_count: story.viewCount,
        is_viewed: isViewed,
        created_at: story.createdAt,
      });
      if (!isViewed) group.has_unviewed = true;
    });

    res.json({ groups: Array.from(groups.values()) });
  } catch (error) {
    next(error);
  }
});

// Create story
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = createStorySchema.parse(req.body);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const story = await prisma.story.create({
      data: {
        userId: req.user!.id,
        mediaType: data.media_type,
        mediaUrl: data.media_url || '',
        text: data.text,
        textStyle: data.text_style,
        backgroundColor: data.background_color,
        stickers: data.stickers,
        privacy: data.privacy || 'EVERYONE',
        expiresAt,
      },
    });

    res.status(201).json({ story });
  } catch (error) {
    next(error);
  }
});

// View story
router.post('/view', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { story_id } = req.body;

    await prisma.storyView.upsert({
      where: {
        storyId_viewerId: {
          storyId: story_id,
          viewerId: req.user!.id,
        },
      },
      update: {},
      create: {
        storyId: story_id,
        viewerId: req.user!.id,
      },
    });

    await prisma.story.update({
      where: { id: story_id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Like story
router.post('/like', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { story_id } = req.body;

    await prisma.storyView.upsert({
      where: {
        storyId_viewerId: {
          storyId: story_id,
          viewerId: req.user!.id,
        },
      },
      update: { liked: true },
      create: {
        storyId: story_id,
        viewerId: req.user!.id,
        liked: true,
      },
    });

    await prisma.story.update({
      where: { id: story_id },
      data: { likeCount: { increment: 1 } },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Reply to story
router.post('/reply', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { story_id, message } = req.body;

    const story = await prisma.story.findUnique({
      where: { id: story_id },
    });

    if (!story) {
      throw new AppError(404, 'Story not found');
    }

    // Find or create conversation with story owner
    let conversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: [req.user!.id, story.userId] },
          },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: req.user!.id },
              { userId: story.userId },
            ],
          },
        },
      });
    }

    // Send message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user!.id,
        content: message,
        contentType: 'TEXT',
      },
    });

    // Mark as replied
    await prisma.storyView.upsert({
      where: {
        storyId_viewerId: {
          storyId: story_id,
          viewerId: req.user!.id,
        },
      },
      update: { replied: true },
      create: {
        storyId: story_id,
        viewerId: req.user!.id,
        replied: true,
      },
    });

    // Send push notification to story owner
    const replier = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { displayName: true },
    });

    push.sendStoryReplyNotification(story.userId, replier?.displayName || 'Someone')
      .catch(err => console.error('Push notification failed:', err));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete story
router.delete('/:storyId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { storyId } = req.params;

    const story = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story || story.userId !== req.user!.id) {
      throw new AppError(404, 'Story not found');
    }

    await prisma.story.delete({ where: { id: storyId } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get story viewers
router.get('/:storyId/viewers', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { storyId } = req.params;

    const story = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story || story.userId !== req.user!.id) {
      throw new AppError(404, 'Story not found');
    }

    const views = await prisma.storyView.findMany({
      where: { storyId },
      include: {
        viewer: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
          },
        },
      },
      orderBy: { viewedAt: 'desc' },
    });

    res.json({
      viewers: views.map(v => ({
        viewer_id: v.viewer.id,
        viewer_name: v.viewer.displayName,
        viewer_photo: v.viewer.profilePhoto,
        viewed_at: v.viewedAt,
        liked: v.liked,
        replied: v.replied,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

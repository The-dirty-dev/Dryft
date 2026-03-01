import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { messageRateLimit } from '../middleware/rateLimit.js';
import * as push from '../services/push.js';
import { messageLimitMiddleware, incrementDailyUsage } from '../services/dailyLimits.js';

const router = Router();

// =============================================================================
// Constants (CODE-005: Replace magic numbers)
// =============================================================================

const MESSAGES_DEFAULT_LIMIT = 50;
const MESSAGES_MAX_LIMIT = 100;
const SEARCH_RESULTS_DEFAULT_LIMIT = 20;
const SEARCH_RESULTS_MAX_LIMIT = 50;

// =============================================================================
// Schemas
// =============================================================================

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  content_type: z.enum(['TEXT', 'IMAGE', 'VOICE', 'GIF', 'HAPTIC', 'LINK']).optional(),
  media_url: z.string().url().optional(),
  reply_to_id: z.string().uuid().optional(),
});

// =============================================================================
// Routes
// =============================================================================

// Get conversations
router.get('/conversations', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // PERF-007: Optimized query with select to avoid Cartesian product
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true,
        conversation: {
          select: {
            id: true,
            lastMessageAt: true,
            participants: {
              select: {
                userId: true,
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    profilePhoto: true,
                    isOnline: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                contentType: true,
                senderId: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });

    // PERF-004: Use efficient count queries instead of loading all messages
    // Build unread counts in parallel for all conversations
    const unreadCounts = await Promise.all(
      participants.map(async (p) => {
        const whereClause: any = {
          conversationId: p.conversationId,
          senderId: { not: userId },
          deletedAt: null,
        };

        // Only count messages after lastReadAt if set
        if (p.lastReadAt) {
          whereClause.createdAt = { gt: p.lastReadAt };
        }

        return prisma.message.count({ where: whereClause });
      })
    );

    const conversations = participants.map((p, index) => {
      const otherParticipant = p.conversation.participants.find(
        part => part.userId !== userId
      );
      const otherUser = otherParticipant?.user;
      const lastMessage = p.conversation.messages[0];

      return {
        id: p.conversation.id,
        other_user: otherUser ? {
          id: otherUser.id,
          display_name: otherUser.displayName,
          profile_photo: otherUser.profilePhoto,
          is_online: otherUser.isOnline,
        } : null,
        last_message: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          content_type: lastMessage.contentType,
          sender_id: lastMessage.senderId,
          created_at: lastMessage.createdAt,
        } : null,
        unread_count: unreadCounts[index],
        is_muted: p.isMuted,
        updated_at: p.conversation.updatedAt,
      };
    });

    res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

// Get messages in conversation
router.get('/conversations/:conversationId/messages', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || MESSAGES_DEFAULT_LIMIT, MESSAGES_MAX_LIMIT);
    const before = req.query.before as string;

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user!.id,
        },
      },
    });

    if (!participant) {
      throw new AppError(404, 'Conversation not found');
    }

    const whereClause: any = {
      conversationId,
      deletedAt: null,
    };

    // ERR-004: Validate date input before using
    if (before) {
      if (isNaN(Date.parse(before))) {
        throw new AppError(400, 'Invalid "before" date format');
      }
      whereClause.createdAt = { lt: new Date(before) };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
          },
        },
      },
    });

    // Mark as read
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user!.id,
        },
      },
      data: { lastReadAt: new Date() },
    });

    res.json({
      messages: messages.reverse().map(m => ({
        id: m.id,
        conversation_id: m.conversationId,
        sender_id: m.senderId,
        sender: {
          id: m.sender.id,
          display_name: m.sender.displayName,
          profile_photo: m.sender.profilePhoto,
        },
        content: m.content,
        content_type: m.contentType,
        media_url: m.mediaUrl,
        reply_to: m.replyTo ? {
          id: m.replyTo.id,
          content: m.replyTo.content,
          sender_id: m.replyTo.senderId,
        } : null,
        read_at: m.readAt,
        created_at: m.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/conversations/:conversationId/messages', messageRateLimit, authenticate, messageLimitMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { conversationId } = req.params;
    const data = sendMessageSchema.parse(req.body);

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user!.id,
        },
      },
    });

    if (!participant) {
      throw new AppError(404, 'Conversation not found');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user!.id,
        content: data.content,
        contentType: data.content_type || 'TEXT',
        mediaUrl: data.media_url,
        replyToId: data.reply_to_id,
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
          },
        },
      },
    });

    // Increment daily message usage
    await incrementDailyUsage(req.user!.id, 'messages');

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Get recipient and send push notification
    const otherParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: { not: req.user!.id },
      },
      include: {
        user: {
          select: { id: true, isOnline: true },
        },
      },
    });

    // Only send push if recipient is offline and conversation is not muted
    if (otherParticipant && !otherParticipant.isMuted) {
      const recipient = otherParticipant.user;
      // Don't send push if user is online (they'll get real-time via socket)
      if (!recipient.isOnline) {
        push.sendMessageNotification(
          recipient.id,
          message.sender.displayName || 'Someone',
          data.content,
          conversationId,
          message.sender.profilePhoto || undefined
        ).catch(err => { /* Push error logged in service */ });
      }
    }

    res.status(201).json({
      id: message.id,
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      content: message.content,
      content_type: message.contentType,
      media_url: message.mediaUrl,
      created_at: message.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

// Mark conversation as read
router.post('/conversations/:conversationId/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { conversationId } = req.params;

    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user!.id,
        },
      },
      data: { lastReadAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mute/unmute conversation
router.post('/conversations/:conversationId/mute', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { conversationId } = req.params;
    const { muted } = req.body;

    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user!.id,
        },
      },
      data: { isMuted: muted },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Message Search
// =============================================================================

// Search query constraints
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MAX_LENGTH = 100;

// Search messages in a conversation
router.get('/conversations/:conversationId/search', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { conversationId } = req.params;
    const { q: query, limit = '20', before, after } = req.query;

    // Validate search query
    if (!query || typeof query !== 'string') {
      throw new AppError(400, 'Search query is required');
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < SEARCH_MIN_LENGTH) {
      throw new AppError(400, `Search query must be at least ${SEARCH_MIN_LENGTH} characters`);
    }
    if (trimmedQuery.length > SEARCH_MAX_LENGTH) {
      throw new AppError(400, `Search query must not exceed ${SEARCH_MAX_LENGTH} characters`);
    }

    // Validate date parameters if provided
    if (before && isNaN(Date.parse(before as string))) {
      throw new AppError(400, 'Invalid "before" date format');
    }
    if (after && isNaN(Date.parse(after as string))) {
      throw new AppError(400, 'Invalid "after" date format');
    }

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user!.id,
        },
      },
    });

    if (!participant) {
      throw new AppError(404, 'Conversation not found');
    }

    const whereClause: any = {
      conversationId,
      deletedAt: null,
      content: {
        contains: trimmedQuery,
        mode: 'insensitive',
      },
    };

    // Date filters (already validated above)
    if (before) {
      whereClause.createdAt = { ...whereClause.createdAt, lt: new Date(before as string) };
    }
    if (after) {
      whereClause.createdAt = { ...whereClause.createdAt, gt: new Date(after as string) };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      take: Math.min(parseInt(limit as string) || SEARCH_RESULTS_DEFAULT_LIMIT, SEARCH_RESULTS_MAX_LIMIT),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
          },
        },
      },
    });

    // Get total count for pagination info
    const totalCount = await prisma.message.count({ where: whereClause });

    res.json({
      query: trimmedQuery,
      results: messages.map(m => ({
        id: m.id,
        conversation_id: m.conversationId,
        sender_id: m.senderId,
        sender: {
          id: m.sender.id,
          display_name: m.sender.displayName,
          profile_photo: m.sender.profilePhoto,
        },
        content: m.content,
        content_type: m.contentType,
        // Highlight the search term in content
        highlighted_content: highlightSearchTerm(m.content, trimmedQuery),
        created_at: m.createdAt,
      })),
      total: totalCount,
    });
  } catch (error) {
    next(error);
  }
});

// Search across all conversations
router.get('/search', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { q: query, limit = '20' } = req.query;

    // Validate search query
    if (!query || typeof query !== 'string') {
      throw new AppError(400, 'Search query is required');
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < SEARCH_MIN_LENGTH) {
      throw new AppError(400, `Search query must be at least ${SEARCH_MIN_LENGTH} characters`);
    }
    if (trimmedQuery.length > SEARCH_MAX_LENGTH) {
      throw new AppError(400, `Search query must not exceed ${SEARCH_MAX_LENGTH} characters`);
    }

    // Get all conversations user is part of
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId: req.user!.id },
      select: { conversationId: true },
    });

    const conversationIds = participants.map(p => p.conversationId);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        content: {
          contains: trimmedQuery,
          mode: 'insensitive',
        },
      },
      take: Math.min(parseInt(limit as string) || SEARCH_RESULTS_DEFAULT_LIMIT, SEARCH_RESULTS_MAX_LIMIT),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
          },
        },
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    profilePhoto: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    res.json({
      query: trimmedQuery,
      results: messages.map(m => {
        const otherUser = m.conversation.participants.find(
          p => p.userId !== req.user!.id
        )?.user;

        return {
          id: m.id,
          conversation_id: m.conversationId,
          sender_id: m.senderId,
          sender: {
            id: m.sender.id,
            display_name: m.sender.displayName,
            profile_photo: m.sender.profilePhoto,
          },
          other_user: otherUser ? {
            id: otherUser.id,
            display_name: otherUser.displayName,
            profile_photo: otherUser.profilePhoto,
          } : null,
          content: m.content,
          content_type: m.contentType,
          highlighted_content: highlightSearchTerm(m.content, trimmedQuery),
          created_at: m.createdAt,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

// Helper to highlight search terms
function highlightSearchTerm(content: string, term: string): string {
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return content.replace(regex, '**$1**');
}

// Delete message
router.delete('/messages/:messageId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.senderId !== req.user!.id) {
      throw new AppError(404, 'Message not found');
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

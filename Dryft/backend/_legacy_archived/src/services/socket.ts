import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: { id: string; displayName: string };
}

interface JwtPayload {
  userId: string;
  sessionId: string;
}

// Track online users
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

export function initializeSocket(io: SocketServer) {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, displayName: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    logger.info(`User connected: ${userId}, socket: ${socket.id}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Notify matches that user is online
    broadcastPresence(io, userId, 'online');

    // ==========================================================================
    // Chat Events
    // ==========================================================================

    // Join a conversation room
    socket.on('conversation:join', async (conversationId: string) => {
      try {
        // Verify user is participant
        const participant = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId,
            },
          },
        });

        if (participant) {
          socket.join(`conversation:${conversationId}`);
          logger.debug(`User ${userId} joined conversation ${conversationId}`);
        }
      } catch (error) {
        logger.error('Error joining conversation:', error);
      }
    });

    // Leave a conversation room
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(`User ${userId} left conversation ${conversationId}`);
    });

    // Send message
    socket.on('message:send', async (data: {
      conversationId: string;
      content: string;
      contentType?: string;
      replyToId?: string;
    }) => {
      try {
        const { conversationId, content, contentType = 'TEXT', replyToId } = data;

        // Verify participation
        const participant = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId,
            },
          },
        });

        if (!participant) {
          socket.emit('error', { message: 'Not a participant' });
          return;
        }

        // Create message
        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content,
            contentType,
            replyToId,
          },
          include: {
            sender: {
              select: { id: true, displayName: true, profilePhoto: true },
            },
          },
        });

        // Update conversation
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() },
        });

        // Broadcast to conversation room
        io.to(`conversation:${conversationId}`).emit('message:new', {
          id: message.id,
          conversation_id: message.conversationId,
          sender: message.sender,
          content: message.content,
          content_type: message.contentType,
          reply_to_id: message.replyToId,
          created_at: message.createdAt,
        });

        // Send push notification to offline participants
        const participants = await prisma.conversationParticipant.findMany({
          where: {
            conversationId,
            userId: { not: userId },
          },
        });

        for (const p of participants) {
          if (!isUserOnline(p.userId)) {
            // Queue push notification
            await prisma.notification.create({
              data: {
                userId: p.userId,
                type: 'MESSAGE',
                title: socket.user!.displayName,
                body: contentType === 'TEXT' ? content.slice(0, 100) : 'Sent you a message',
                data: { conversationId, messageId: message.id },
              },
            });
          }
        }

        logger.debug(`Message sent in conversation ${conversationId}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        isTyping: false,
      });
    });

    // Mark messages as read
    socket.on('message:read', async (data: {
      conversationId: string;
      messageId: string;
    }) => {
      try {
        const { conversationId, messageId } = data;

        await prisma.message.updateMany({
          where: {
            conversationId,
            id: { lte: messageId },
            senderId: { not: userId },
            readAt: null,
          },
          data: { readAt: new Date() },
        });

        // Notify sender
        socket.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          messageId,
          readBy: userId,
          readAt: new Date(),
        });
      } catch (error) {
        logger.error('Error marking messages read:', error);
      }
    });

    // ==========================================================================
    // Video Call Events
    // ==========================================================================

    socket.on('call:initiate', async (data: { targetUserId: string }) => {
      try {
        const { targetUserId } = data;

        // Check if target is online
        if (!isUserOnline(targetUserId)) {
          socket.emit('call:error', { message: 'User is offline' });
          return;
        }

        // Notify target user
        io.to(`user:${targetUserId}`).emit('call:incoming', {
          callerId: userId,
          callerName: socket.user!.displayName,
        });
      } catch (error) {
        logger.error('Error initiating call:', error);
      }
    });

    socket.on('call:accept', (data: { callerId: string }) => {
      io.to(`user:${data.callerId}`).emit('call:accepted', {
        acceptedBy: userId,
      });
    });

    socket.on('call:decline', (data: { callerId: string }) => {
      io.to(`user:${data.callerId}`).emit('call:declined', {
        declinedBy: userId,
      });
    });

    socket.on('call:end', (data: { targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('call:ended', {
        endedBy: userId,
      });
    });

    // WebRTC signaling
    socket.on('webrtc:offer', (data: { targetUserId: string; offer: any }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:offer', {
        from: userId,
        offer: data.offer,
      });
    });

    socket.on('webrtc:answer', (data: { targetUserId: string; answer: any }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:answer', {
        from: userId,
        answer: data.answer,
      });
    });

    socket.on('webrtc:ice-candidate', (data: { targetUserId: string; candidate: any }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc:ice-candidate', {
        from: userId,
        candidate: data.candidate,
      });
    });

    // ==========================================================================
    // Presence Events
    // ==========================================================================

    socket.on('presence:subscribe', async (userIds: string[]) => {
      // Subscribe to presence updates for specific users
      for (const targetId of userIds) {
        socket.join(`presence:${targetId}`);
      }

      // Send current status
      const statuses = userIds.map(id => ({
        userId: id,
        status: isUserOnline(id) ? 'online' : 'offline',
      }));

      socket.emit('presence:status', statuses);
    });

    socket.on('presence:unsubscribe', (userIds: string[]) => {
      for (const targetId of userIds) {
        socket.leave(`presence:${targetId}`);
      }
    });

    // ==========================================================================
    // VR Session Events
    // ==========================================================================

    // Join a VR companion session
    socket.on('session:join', async (data: { sessionCode: string; displayName?: string }) => {
      try {
        const { sessionCode, displayName } = data;
        const sessionRoom = `vr-session:${sessionCode}`;

        // Join the session room
        socket.join(sessionRoom);

        // Notify other participants
        socket.to(sessionRoom).emit('session:user_joined', {
          userId,
          displayName: displayName || socket.user?.displayName,
          deviceType: 'mobile',
          timestamp: new Date(),
        });

        logger.info(`User ${userId} joined VR session ${sessionCode}`);
      } catch (error) {
        logger.error('Error joining VR session:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Leave VR session
    socket.on('session:leave', (sessionCode: string) => {
      const sessionRoom = `vr-session:${sessionCode}`;
      socket.leave(sessionRoom);

      socket.to(sessionRoom).emit('session:user_left', {
        userId,
        timestamp: new Date(),
      });

      logger.info(`User ${userId} left VR session ${sessionCode}`);
    });

    // Send haptic command in session
    socket.on('session:haptic', (data: {
      sessionCode: string;
      targetUserId: string;
      command: 'vibrate' | 'rotate' | 'stop';
      intensity?: number;
      durationMs?: number;
    }) => {
      const sessionRoom = `vr-session:${data.sessionCode}`;

      io.to(sessionRoom).emit('session:haptic', {
        fromUserId: userId,
        toUserId: data.targetUserId,
        command: data.command,
        intensity: data.intensity,
        durationMs: data.durationMs,
        timestamp: new Date(),
      });
    });

    // Chat in VR session
    socket.on('session:chat', (data: { sessionCode: string; content: string }) => {
      const sessionRoom = `vr-session:${data.sessionCode}`;

      io.to(sessionRoom).emit('session:chat', {
        userId,
        displayName: socket.user?.displayName,
        content: data.content,
        timestamp: new Date(),
      });
    });

    // VR state update (position, activity, etc.)
    socket.on('session:state', (data: {
      sessionCode: string;
      state: {
        currentActivity?: string;
        currentRoom?: string;
        hapticDeviceConnected?: boolean;
        hapticDeviceName?: string;
        hapticIntensity?: number;
      };
    }) => {
      const sessionRoom = `vr-session:${data.sessionCode}`;

      socket.to(sessionRoom).emit('session:state', {
        userId,
        state: data.state,
        timestamp: new Date(),
      });
    });

    // ==========================================================================
    // VR Recording Detection Events
    // ==========================================================================

    // VR headset detected recording started
    socket.on('vr:recording_started', (data: { sessionCode?: string }) => {
      logger.warn(`VR recording detected for user ${userId}`);

      // If in a session, notify other participants
      if (data.sessionCode) {
        const sessionRoom = `vr-session:${data.sessionCode}`;

        io.to(sessionRoom).emit('security:recording_detected', {
          userId,
          displayName: socket.user?.displayName,
          deviceType: 'vr',
          timestamp: new Date(),
        });

        // Log security event
        prisma.securityLog.create({
          data: {
            userId,
            eventType: 'VR_RECORDING_DETECTED',
            metadata: { sessionCode: data.sessionCode },
            ipAddress: socket.handshake.address,
          },
        }).catch(err => logger.error('Failed to log security event:', err));
      }
    });

    // VR headset recording stopped
    socket.on('vr:recording_stopped', (data: { sessionCode?: string }) => {
      if (data.sessionCode) {
        const sessionRoom = `vr-session:${data.sessionCode}`;

        io.to(sessionRoom).emit('security:recording_stopped', {
          userId,
          timestamp: new Date(),
        });
      }
    });

    // Mobile app detected screen capture
    socket.on('mobile:capture_detected', (data: { sessionCode?: string; captureType: 'screenshot' | 'recording' }) => {
      logger.warn(`Mobile screen capture detected for user ${userId}: ${data.captureType}`);

      if (data.sessionCode) {
        const sessionRoom = `vr-session:${data.sessionCode}`;

        io.to(sessionRoom).emit('security:capture_detected', {
          userId,
          displayName: socket.user?.displayName,
          deviceType: 'mobile',
          captureType: data.captureType,
          timestamp: new Date(),
        });
      }

      // Log security event
      prisma.securityLog.create({
        data: {
          userId,
          eventType: 'MOBILE_CAPTURE_DETECTED',
          metadata: {
            sessionCode: data.sessionCode,
            captureType: data.captureType,
          },
          ipAddress: socket.handshake.address,
        },
      }).catch(err => logger.error('Failed to log security event:', err));
    });

    // ==========================================================================
    // Location Events
    // ==========================================================================

    socket.on('location:update', async (data: {
      latitude: number;
      longitude: number;
    }) => {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            lastLatitude: data.latitude,
            lastLongitude: data.longitude,
            lastLocationUpdate: new Date(),
          },
        });
      } catch (error) {
        logger.error('Error updating location:', error);
      }
    });

    // ==========================================================================
    // Disconnect
    // ==========================================================================

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userId}, socket: ${socket.id}`);

      // Remove from online tracking
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Notify matches that user is offline
          broadcastPresence(io, userId, 'offline');

          // Update last seen
          prisma.user.update({
            where: { id: userId },
            data: { lastSeen: new Date() },
          }).catch(err => logger.error('Error updating last seen:', err));
        }
      }
    });
  });

  logger.info('Socket.IO initialized');
}

// Helper functions

function isUserOnline(userId: string): boolean {
  const sockets = onlineUsers.get(userId);
  return sockets !== undefined && sockets.size > 0;
}

async function broadcastPresence(
  io: SocketServer,
  userId: string,
  status: 'online' | 'offline'
) {
  // Broadcast to users subscribed to this user's presence
  io.to(`presence:${userId}`).emit('presence:change', {
    userId,
    status,
    timestamp: new Date(),
  });
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

export function isOnline(userId: string): boolean {
  return isUserOnline(userId);
}

export function emitToUser(io: SocketServer, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToConversation(
  io: SocketServer,
  conversationId: string,
  event: string,
  data: any
) {
  io.to(`conversation:${conversationId}`).emit(event, data);
}

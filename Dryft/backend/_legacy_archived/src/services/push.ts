import admin from 'firebase-admin';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { withCircuitBreaker, isServiceAvailable, CircuitBreakerError } from './circuitBreaker.js';

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    if (config.firebase.serviceAccountKey) {
      admin.initializeApp({
        credential: admin.credential.cert(
          JSON.parse(config.firebase.serviceAccountKey)
        ),
      });
      firebaseInitialized = true;
      logger.info('Firebase Admin SDK initialized');
    } else {
      logger.warn('Firebase service account key not configured');
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
  }
}

// Initialize on module load
initializeFirebase();

// =============================================================================
// Token Management
// =============================================================================

export async function registerPushToken(params: {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
}): Promise<void> {
  await prisma.pushToken.upsert({
    where: {
      userId_token: {
        userId: params.userId,
        token: params.token,
      },
    },
    update: {
      platform: params.platform,
      deviceId: params.deviceId,
      updatedAt: new Date(),
    },
    create: {
      userId: params.userId,
      token: params.token,
      platform: params.platform,
      deviceId: params.deviceId,
    },
  });
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await prisma.pushToken.deleteMany({
    where: { userId, token },
  });
}

export async function getUserTokens(userId: string): Promise<string[]> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });
  return tokens.map(t => t.token);
}

// =============================================================================
// Send Notifications
// =============================================================================

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
}

export async function sendPushNotification(
  userId: string,
  notification: PushNotification
): Promise<void> {
  if (!firebaseInitialized) {
    logger.warn('Firebase not initialized, skipping push notification');
    return;
  }

  // ARCH-007: Check circuit breaker before proceeding
  if (!isServiceAvailable('firebase')) {
    logger.warn('Firebase circuit breaker is open, skipping push notification', { userId });
    return;
  }

  const tokens = await getUserTokens(userId);
  if (tokens.length === 0) {
    logger.debug(`No push tokens for user ${userId}`);
    return;
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data,
      android: {
        notification: {
          sound: notification.sound || 'default',
          channelId: 'drift_notifications',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: notification.sound || 'default',
            badge: notification.badge,
          },
        },
      },
    };

    // ARCH-007: Wrap Firebase call with circuit breaker
    const response = await withCircuitBreaker('firebase', () =>
      admin.messaging().sendEachForMulticast(message)
    );

    logger.info(
      `Push notification sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failed`
    );

    // Remove invalid tokens
    response.responses.forEach((result, index) => {
      if (!result.success) {
        const error = result.error;
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          unregisterPushToken(userId, tokens[index]).catch(err =>
            logger.error('Failed to unregister invalid token:', err)
          );
        }
      }
    });
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      logger.warn('Push notification skipped due to circuit breaker', { userId, service: error.serviceName });
    } else {
      logger.error(`Failed to send push notification to user ${userId}:`, error);
    }
  }
}

export async function sendPushToMultipleUsers(
  userIds: string[],
  notification: PushNotification
): Promise<void> {
  await Promise.all(
    userIds.map(userId => sendPushNotification(userId, notification))
  );
}

// =============================================================================
// Notification Types
// =============================================================================

export async function sendMatchNotification(
  userId: string,
  matchName: string,
  matchPhoto?: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'It\'s a Match! 💕',
    body: `You and ${matchName} liked each other!`,
    data: {
      type: 'MATCH',
      matchName,
    },
    imageUrl: matchPhoto,
    sound: 'match.wav',
  });
}

export async function sendMessageNotification(
  userId: string,
  senderName: string,
  message: string,
  conversationId: string,
  senderPhoto?: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: senderName,
    body: message.length > 100 ? message.slice(0, 97) + '...' : message,
    data: {
      type: 'MESSAGE',
      conversationId,
      senderName,
    },
    imageUrl: senderPhoto,
    sound: 'notification.wav',
  });
}

export async function sendLikeNotification(
  userId: string,
  hasPremium: boolean
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Someone likes you! 💜',
    body: hasPremium
      ? 'Check out who likes you in the Likes tab'
      : 'Upgrade to see who likes you',
    data: { type: 'LIKE' },
  });
}

export async function sendSuperLikeNotification(
  userId: string,
  senderName: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'You got a Super Like! ⭐',
    body: `${senderName} super liked you!`,
    data: {
      type: 'SUPER_LIKE',
      senderName,
    },
  });
}

export async function sendGiftNotification(
  userId: string,
  senderName: string | null,
  giftType: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'You received a gift! 🎁',
    body: senderName
      ? `${senderName} sent you a ${giftType}!`
      : `Someone sent you a ${giftType}!`,
    data: {
      type: 'GIFT',
      giftType,
    },
  });
}

export async function sendVerificationNotification(
  userId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  await sendPushNotification(userId, {
    title: status === 'approved' ? 'Verified! ✓' : 'Verification Update',
    body: status === 'approved'
      ? 'Congratulations! Your profile is now verified.'
      : 'Your verification request needs more information.',
    data: {
      type: 'VERIFICATION',
      status,
    },
  });
}

export async function sendStoryReplyNotification(
  userId: string,
  replierName: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Story Reply',
    body: `${replierName} replied to your story`,
    data: {
      type: 'STORY_REPLY',
      replierName,
    },
  });
}

// =============================================================================
// Couple-Specific Notifications
// =============================================================================

export async function sendPartnerActivityNotification(
  userId: string,
  partnerName: string,
  activityTitle: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Activity Completed! 🎉',
    body: `${partnerName} completed "${activityTitle}"`,
    data: {
      type: 'PARTNER_ACTIVITY',
      activityTitle,
    },
  });
}

export async function sendStreakReminderNotification(
  userId: string,
  currentStreak: number
): Promise<void> {
  await sendPushNotification(userId, {
    title: `Your ${currentStreak}-day streak is at risk! 🔥`,
    body: 'Complete an activity today to keep your streak going',
    data: {
      type: 'STREAK_REMINDER',
      streak: currentStreak.toString(),
    },
  });
}

export async function sendAchievementUnlockedNotification(
  userId: string,
  achievementName: string,
  xpReward: number
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Achievement Unlocked! 🏆',
    body: `You earned "${achievementName}" (+${xpReward} XP)`,
    data: {
      type: 'ACHIEVEMENT',
      achievementName,
    },
  });
}

export async function sendQuizCompletedNotification(
  userId: string,
  partnerName: string,
  quizTitle: string,
  matchPercentage: number
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Quiz Results Ready! 🧠',
    body: `You and ${partnerName} matched ${matchPercentage}% on "${quizTitle}"`,
    data: {
      type: 'QUIZ_RESULT',
      quizTitle,
      matchPercentage: matchPercentage.toString(),
    },
  });
}

export async function sendDateReminderNotification(
  userId: string,
  dateTitle: string,
  scheduledTime: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Date Coming Up! 💝',
    body: `"${dateTitle}" is scheduled for ${scheduledTime}`,
    data: {
      type: 'DATE_REMINDER',
      dateTitle,
    },
  });
}

export async function sendPartnerInviteNotification(
  userId: string,
  partnerName: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Couple Invite! 💕',
    body: `${partnerName} wants to connect with you on Drift`,
    data: {
      type: 'COUPLE_INVITE',
      partnerName,
    },
  });
}

// =============================================================================
// Topics (for broadcast notifications)
// =============================================================================

export async function subscribeToTopic(token: string, topic: string): Promise<void> {
  if (!firebaseInitialized) return;

  try {
    await admin.messaging().subscribeToTopic([token], topic);
  } catch (error) {
    logger.error(`Failed to subscribe to topic ${topic}:`, error);
  }
}

export async function unsubscribeFromTopic(token: string, topic: string): Promise<void> {
  if (!firebaseInitialized) return;

  try {
    await admin.messaging().unsubscribeFromTopic([token], topic);
  } catch (error) {
    logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
  }
}

export async function sendTopicNotification(
  topic: string,
  notification: PushNotification
): Promise<void> {
  if (!firebaseInitialized) return;

  try {
    await admin.messaging().send({
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data,
    });
    logger.info(`Topic notification sent to ${topic}`);
  } catch (error) {
    logger.error(`Failed to send topic notification to ${topic}:`, error);
  }
}

import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import {
  notificationService,
  NotificationAction,
  NotificationData,
} from '../services/notifications';
import { api } from '../services/api';
import { useOfflineActions } from './useOffline';

interface NotificationActionsConfig {
  onMatchCreated?: (matchId: string, userId: string) => void;
  onMessageSent?: (matchId: string, message: string) => void;
  onNavigate?: (screen: string, params?: object) => void;
}

/**
 * React hook `useNotificationActions`.
 * @param config? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useNotificationActions(config?);
 */
export function useNotificationActions(config?: NotificationActionsConfig) {
  const navigation = useNavigation();
  const { queueLike, queueBlock, queueMessage: queueOfflineMessage } = useOfflineActions();
  const configRef = useRef(config);
  configRef.current = config;

  const handleAction = useCallback(
    async (action: NotificationAction, data: NotificationData, input?: string) => {
      console.log('[NotificationActions] Handling action:', action, data, input);

      switch (action) {
        case 'REPLY':
          if (data.match_id && input) {
            await handleReply(data.match_id, input);
          }
          break;

        case 'MARK_READ':
          if (data.match_id) {
            await handleMarkRead(data.match_id);
          }
          break;

        case 'LIKE_BACK':
          if (data.user_id) {
            await handleLikeBack(data.user_id);
          }
          break;

        case 'PASS':
          if (data.user_id) {
            await handlePass(data.user_id);
          }
          break;

        case 'SAY_HI':
          if (data.match_id || data.user_id) {
            handleSayHi(data.match_id, data.user_id);
          }
          break;

        case 'VIEW_PROFILE':
          if (data.user_id) {
            handleViewProfile(data.user_id);
          }
          break;

        case 'JOIN_VR':
          if (data.session_code) {
            handleJoinVR(data.session_code);
          }
          break;

        case 'DECLINE_VR':
          if (data.session_code) {
            await handleDeclineVR(data.session_code);
          }
          break;

        case 'BLOCK':
          if (data.user_id) {
            await handleBlock(data.user_id);
          }
          break;

        case 'REPORT':
          if (data.user_id) {
            handleReport(data.user_id);
          }
          break;

        case 'DISMISS':
          // Just dismiss, no action needed
          break;

        default:
          console.warn('[NotificationActions] Unknown action:', action);
      }
    },
    []
  );

  const handleReply = async (matchId: string, message: string) => {
    try {
      await api.post(`/v1/matches/${matchId}/messages`, {
        content: message,
      });
      configRef.current?.onMessageSent?.(matchId, message);
    } catch (error) {
      console.error('[NotificationActions] Failed to send reply:', error);
      // Queue for offline sending
      queueOfflineMessage(matchId, message, `msg_${Date.now()}`);
    }
  };

  const handleMarkRead = async (matchId: string) => {
    try {
      await api.post(`/v1/matches/${matchId}/read`);
      await notificationService.clearBadge();
    } catch (error) {
      console.error('[NotificationActions] Failed to mark as read:', error);
    }
  };

  const handleLikeBack = async (userId: string) => {
    try {
      const response = await api.post('/v1/swipes', {
        target_user_id: userId,
        action: 'like',
      });

      if (response.data?.match) {
        configRef.current?.onMatchCreated?.(response.data.match.id, userId);
        // Send local match notification
        await notificationService.sendMatchNotification(
          response.data.match.user_name || 'Someone',
          response.data.match.id,
          userId
        );
      }
    } catch (error) {
      console.error('[NotificationActions] Failed to like back:', error);
      queueLike(userId);
    }
  };

  const handlePass = async (userId: string) => {
    try {
      await api.post('/v1/swipes', {
        target_user_id: userId,
        action: 'pass',
      });
    } catch (error) {
      console.error('[NotificationActions] Failed to pass:', error);
    }
  };

  const handleSayHi = (matchId?: string, userId?: string) => {
    if (matchId) {
      configRef.current?.onNavigate?.('Chat', { matchId, autoFocus: true });
      (navigation as any).navigate('Chat', { matchId, autoFocus: true });
    } else if (userId) {
      configRef.current?.onNavigate?.('Profile', { userId, startConversation: true });
      (navigation as any).navigate('Profile', { userId, startConversation: true });
    }
  };

  const handleViewProfile = (userId: string) => {
    configRef.current?.onNavigate?.('Profile', { userId });
    (navigation as any).navigate('Profile', { userId });
  };

  const handleJoinVR = (sessionCode: string) => {
    configRef.current?.onNavigate?.('Companion', { sessionCode, autoJoin: true });
    (navigation as any).navigate('Companion', { sessionCode, autoJoin: true });
  };

  const handleDeclineVR = async (sessionCode: string) => {
    try {
      await api.post(`/v1/vr/sessions/${sessionCode}/decline`);
    } catch (error) {
      console.error('[NotificationActions] Failed to decline VR:', error);
    }
  };

  const handleBlock = async (userId: string) => {
    try {
      await api.post(`/v1/users/${userId}/block`);
    } catch (error) {
      console.error('[NotificationActions] Failed to block:', error);
      queueBlock(userId);
    }
  };

  const handleReport = (userId: string) => {
    configRef.current?.onNavigate?.('Report', { userId });
    (navigation as any).navigate('Report', { userId });
  };

  return {
    handleAction,
    handleReply,
    handleMarkRead,
    handleLikeBack,
    handlePass,
    handleSayHi,
    handleViewProfile,
    handleJoinVR,
    handleDeclineVR,
    handleBlock,
    handleReport,
  };
}

/**
 * Hook to initialize notification handling in the app root
 */
/**
 * React hook `useNotificationSetup`.
 * @param config? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useNotificationSetup(config?);
 */
export function useNotificationSetup(config?: NotificationActionsConfig) {
  const navigation = useNavigation();
  const { handleAction } = useNotificationActions(config);

  useEffect(() => {
    const handleNotificationReceived = (notification: Notifications.Notification) => {
      // Could show in-app notification here
      console.log('[Notifications] Received in foreground:', notification);
    };

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData;

      // Handle default tap - navigate to appropriate screen
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        notificationService.handleNotificationNavigation(data, (screen, params) => {
          (navigation as any).navigate(screen, params);
          config?.onNavigate?.(screen, params);
        });
      }
    };

    notificationService.initialize(
      handleNotificationReceived,
      handleNotificationResponse,
      handleAction
    );

    return () => {
      notificationService.cleanup();
    };
  }, [handleAction, navigation, config]);

  return {
    sendMessageNotification: notificationService.sendMessageNotification.bind(notificationService),
    sendMatchNotification: notificationService.sendMatchNotification.bind(notificationService),
    sendLikeNotification: notificationService.sendLikeNotification.bind(notificationService),
    sendVRInviteNotification: notificationService.sendVRInviteNotification.bind(notificationService),
    clearNotifications: notificationService.clearAll.bind(notificationService),
    setBadgeCount: notificationService.setBadgeCount.bind(notificationService),
  };
}

/**
 * Hook for notification badge management
 */
/**
 * React hook `useNotificationBadge`.
 * @returns Hook state and actions.
 * @example
 * const value = useNotificationBadge();
 */
export function useNotificationBadge() {
  const getBadge = useCallback(async () => {
    return notificationService.getBadgeCount();
  }, []);

  const setBadge = useCallback(async (count: number) => {
    await notificationService.setBadgeCount(count);
  }, []);

  const incrementBadge = useCallback(async () => {
    await notificationService.incrementBadge();
  }, []);

  const clearBadge = useCallback(async () => {
    await notificationService.clearBadge();
  }, []);

  return {
    getBadge,
    setBadge,
    incrementBadge,
    clearBadge,
  };
}

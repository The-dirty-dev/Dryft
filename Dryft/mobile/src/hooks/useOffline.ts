import { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  useOfflineStore,
  QueuedActionType,
  CachedProfile,
  CachedMessage,
} from '../store/offlineStore';

/**
 * Hook to monitor and respond to network status changes.
 */
/**
 * React hook `useNetworkStatus`.
 * @returns Hook state and actions.
 * @example
 * const value = useNetworkStatus();
 */
export function useNetworkStatus() {
  const { isOnline, connectionType, lastOnlineAt, setNetworkStatus } = useOfflineStore();

  useEffect(() => {
    // Initial check
    NetInfo.fetch().then(setNetworkStatus);

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener(setNetworkStatus);

    return () => {
      unsubscribe();
    };
  }, [setNetworkStatus]);

  return {
    isOnline,
    connectionType,
    lastOnlineAt,
    isWifi: connectionType === 'wifi',
    isCellular: connectionType === 'cellular',
  };
}

/**
 * Hook for queueing actions that will be executed when online.
 */
/**
 * React hook `useOfflineActions`.
 * @returns Hook state and actions.
 * @example
 * const value = useOfflineActions();
 */
export function useOfflineActions() {
  const {
    isOnline,
    actionQueue,
    queueAction,
    removeFromQueue,
    clearQueue,
    processQueue,
  } = useOfflineStore();

  const queueLike = useCallback(
    (userId: string) => {
      queueAction({
        type: 'like',
        payload: { userId },
        priority: 5,
        maxRetries: 3,
      });
    },
    [queueAction]
  );

  const queuePass = useCallback(
    (userId: string) => {
      queueAction({
        type: 'pass',
        payload: { userId },
        priority: 5,
        maxRetries: 3,
      });
    },
    [queueAction]
  );

  const queueSuperLike = useCallback(
    (userId: string) => {
      queueAction({
        type: 'super_like',
        payload: { userId },
        priority: 8,
        maxRetries: 3,
      });
    },
    [queueAction]
  );

  const queueMessage = useCallback(
    (matchId: string, content: string, clientId: string) => {
      queueAction({
        type: 'send_message',
        payload: { matchId, content, clientId },
        priority: 10, // Messages are high priority
        maxRetries: 5,
      });
    },
    [queueAction]
  );

  const queueProfileUpdate = useCallback(
    (profileData: Record<string, any>) => {
      queueAction({
        type: 'update_profile',
        payload: profileData,
        priority: 3,
        maxRetries: 3,
      });
    },
    [queueAction]
  );

  const queueBlock = useCallback(
    (userId: string) => {
      queueAction({
        type: 'block_user',
        payload: { userId },
        priority: 9, // Safety actions are high priority
        maxRetries: 5,
      });
    },
    [queueAction]
  );

  const queueReport = useCallback(
    (userId: string, reason: string, details?: string) => {
      queueAction({
        type: 'report_user',
        payload: { userId, reason, details },
        priority: 9,
        maxRetries: 5,
      });
    },
    [queueAction]
  );

  return {
    isOnline,
    pendingActions: actionQueue.length,
    queueLike,
    queuePass,
    queueSuperLike,
    queueMessage,
    queueProfileUpdate,
    queueBlock,
    queueReport,
    removeFromQueue,
    clearQueue,
    processQueue,
  };
}

/**
 * Hook for caching and retrieving profiles for offline viewing.
 */
/**
 * React hook `useProfileCache`.
 * @returns Hook state and actions.
 * @example
 * const value = useProfileCache();
 */
export function useProfileCache() {
  const {
    isOnline,
    cachedProfiles,
    cacheProfiles,
    getCachedProfiles,
    clearExpiredCache,
  } = useOfflineStore();

  // Clean expired cache on mount
  useEffect(() => {
    clearExpiredCache();
  }, [clearExpiredCache]);

  const cacheProfile = useCallback(
    (profile: Omit<CachedProfile, 'cachedAt'>) => {
      cacheProfiles([{ ...profile, cachedAt: Date.now() }]);
    },
    [cacheProfiles]
  );

  const getOfflineProfiles = useCallback(() => {
    if (isOnline) return null;
    return getCachedProfiles();
  }, [isOnline, getCachedProfiles]);

  return {
    isOnline,
    cachedCount: cachedProfiles.length,
    cacheProfile,
    cacheProfiles,
    getOfflineProfiles,
    getCachedProfiles,
  };
}

/**
 * Hook for offline message handling.
 */
/**
 * React hook `useOfflineMessages`.
 * @param matchId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useOfflineMessages(matchId);
 */
export function useOfflineMessages(matchId: string) {
  const {
    isOnline,
    cachedMessages,
    cacheMessages,
    addPendingMessage,
    updateMessageStatus,
  } = useOfflineStore();
  const { queueMessage } = useOfflineActions();

  const messages = cachedMessages[matchId] || [];

  const sendMessage = useCallback(
    (content: string) => {
      const clientId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Add to local cache immediately
      const pendingMessage: CachedMessage = {
        id: clientId,
        matchId,
        senderId: 'me', // Will be replaced with actual user ID
        content,
        createdAt: Date.now(),
        status: 'sending',
      };

      addPendingMessage(matchId, pendingMessage);

      // Queue for sending
      queueMessage(matchId, content, clientId);

      return clientId;
    },
    [matchId, addPendingMessage, queueMessage]
  );

  const markMessageSent = useCallback(
    (messageId: string) => {
      updateMessageStatus(matchId, messageId, 'sent');
    },
    [matchId, updateMessageStatus]
  );

  const markMessageFailed = useCallback(
    (messageId: string) => {
      updateMessageStatus(matchId, messageId, 'failed');
    },
    [matchId, updateMessageStatus]
  );

  return {
    isOnline,
    messages,
    sendMessage,
    cacheMessages: (msgs: CachedMessage[]) => cacheMessages(matchId, msgs),
    markMessageSent,
    markMessageFailed,
  };
}

/**
 * Hook for background sync when app comes to foreground.
 */
/**
 * React hook `useBackgroundSync`.
 * @returns Hook state and actions.
 * @example
 * const value = useBackgroundSync();
 */
export function useBackgroundSync() {
  const { isOnline, syncData, processQueue, lastSyncAt } = useOfflineStore();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isOnline
      ) {
        // App has come to foreground and we're online
        processQueue();
        syncData();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isOnline, processQueue, syncData]);

  return {
    lastSyncAt,
    syncNow: syncData,
  };
}

/**
 * Hook to show offline indicator with auto-hide.
 */
/**
 * React hook `useOfflineIndicator`.
 * @returns Hook state and actions.
 * @example
 * const value = useOfflineIndicator();
 */
export function useOfflineIndicator() {
  const { isOnline, lastOnlineAt, actionQueue } = useOfflineStore();

  const getOfflineDuration = useCallback(() => {
    if (isOnline || !lastOnlineAt) return null;

    const duration = Date.now() - lastOnlineAt;
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return 'Just now';
  }, [isOnline, lastOnlineAt]);

  return {
    isOffline: !isOnline,
    offlineDuration: getOfflineDuration(),
    pendingActions: actionQueue.length,
    hasPendingActions: actionQueue.length > 0,
  };
}

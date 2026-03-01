import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  notificationCenterService,
  Notification,
  NotificationGroup,
  NotificationPreferences,
  NotificationType,
} from '../services/notificationCenter';

// ============================================================================
// useNotifications - Main notifications hook
// ============================================================================

/**
 * React hook `useNotifications`.
 * @returns Hook state and actions.
 * @example
 * const value = useNotifications();
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const load = async () => {
      await notificationCenterService.initialize();
      setNotifications(notificationCenterService.getNotifications());
      setIsLoading(false);
    };

    load();

    const unsubscribe = notificationCenterService.subscribe(() => {
      setNotifications(notificationCenterService.getNotifications());
    });

    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await notificationCenterService.fetchFromServer();
    setIsRefreshing(false);
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    await notificationCenterService.markAsRead(notificationId);
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationCenterService.markAllAsRead();
  }, []);

  const markAsActioned = useCallback(async (notificationId: string) => {
    await notificationCenterService.markAsActioned(notificationId);
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await notificationCenterService.deleteNotification(notificationId);
  }, []);

  const clearAll = useCallback(async () => {
    await notificationCenterService.clearAll();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const groupedNotifications = useMemo(
    () => notificationCenterService.getGroupedNotifications(),
    [notifications]
  );

  return {
    notifications,
    groupedNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    refresh,
    markAsRead,
    markAllAsRead,
    markAsActioned,
    deleteNotification,
    clearAll,
  };
}

// ============================================================================
// useUnreadCount - Just the unread count (for badges)
// ============================================================================

/**
 * React hook `useUnreadCount`.
 * @returns Hook state and actions.
 * @example
 * const value = useUnreadCount();
 */
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      await notificationCenterService.initialize();
      setCount(notificationCenterService.getUnreadCount());
    };

    load();

    const unsubscribe = notificationCenterService.subscribe(() => {
      setCount(notificationCenterService.getUnreadCount());
    });

    return unsubscribe;
  }, []);

  return count;
}

// ============================================================================
// useNotificationPreferences - Notification settings
// ============================================================================

/**
 * React hook `useNotificationPreferences`.
 * @returns Hook state and actions.
 * @example
 * const value = useNotificationPreferences();
 */
export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await notificationCenterService.initialize();
      setPreferences(notificationCenterService.getPreferences());
      setIsLoading(false);
    };

    load();
  }, []);

  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      await notificationCenterService.updatePreferences(updates);
      setPreferences(notificationCenterService.getPreferences());
    },
    []
  );

  const toggleEnabled = useCallback(async () => {
    if (preferences) {
      await updatePreferences({ enabled: !preferences.enabled });
    }
  }, [preferences, updatePreferences]);

  const toggleType = useCallback(
    async (key: keyof Omit<NotificationPreferences, 'enabled' | 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'sound' | 'vibration'>) => {
      if (preferences) {
        await updatePreferences({ [key]: !preferences[key] });
      }
    },
    [preferences, updatePreferences]
  );

  return {
    preferences,
    isLoading,
    updatePreferences,
    toggleEnabled,
    toggleType,
  };
}

// ============================================================================
// useNotificationHelpers - Icon and color helpers
// ============================================================================

/**
 * React hook `useNotificationHelpers`.
 * @returns Hook state and actions.
 * @example
 * const value = useNotificationHelpers();
 */
export function useNotificationHelpers() {
  const getIcon = useCallback((type: NotificationType) => {
    return notificationCenterService.getNotificationIcon(type);
  }, []);

  const getColor = useCallback((type: NotificationType) => {
    return notificationCenterService.getNotificationColor(type);
  }, []);

  const isQuietHours = useCallback(() => {
    return notificationCenterService.isQuietHours();
  }, []);

  return {
    getIcon,
    getColor,
    isQuietHours,
  };
}

export default useNotifications;

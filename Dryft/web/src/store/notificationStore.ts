import { create } from 'zustand';
import { apiClient } from '@/lib/api';

export interface Notification {
  id: string;
  type: 'new_match' | 'new_message' | 'new_like' | 'system' | 'promo';
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

interface UnreadCountResponse {
  count: number;
}

interface NotificationState {
  // Notifications list
  notifications: Notification[];
  isLoadingNotifications: boolean;
  notificationsError: string | null;

  // Unread count (for badge)
  unreadCount: number;

  // Actions
  loadNotifications: () => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  reset: () => void;
}

const initialState = {
  notifications: [],
  isLoadingNotifications: false,
  notificationsError: null,
  unreadCount: 0,
};

/**
 * Zustand store for notifications and unread counts.
 * @returns Notification state and loaders/mark-read actions.
 * @example
 * const { loadNotifications, unreadCount } = useNotificationStore();
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  ...initialState,

  loadNotifications: async () => {
    set({ isLoadingNotifications: true, notificationsError: null });
    try {
      const response = await apiClient.get<NotificationsResponse>('/v1/notifications');
      if (response.success && response.data) {
        set({
          notifications: response.data.notifications || [],
          unreadCount: response.data.unread_count || 0,
          isLoadingNotifications: false,
        });
      } else {
        set({
          notificationsError: response.error || 'Failed to load notifications',
          isLoadingNotifications: false,
        });
      }
    } catch (error) {
      console.error('[notificationStore] Failed to load notifications:', error);
      set({
        notificationsError: error instanceof Error ? error.message : 'Network error',
        isLoadingNotifications: false,
      });
    }
  },

  loadUnreadCount: async () => {
    try {
      const response = await apiClient.get<UnreadCountResponse>('/v1/notifications/unread-count');
      if (response.success && response.data) {
        set({ unreadCount: response.data.count });
      }
    } catch (error) {
      console.error('[notificationStore] Failed to load unread count:', error);
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const response = await apiClient.post(`/v1/notifications/${notificationId}/read`);
      if (response.success) {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === notificationId);
          const wasUnread = notification && !notification.read;
          return {
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        });
      }
    } catch (error) {
      console.error('[notificationStore] Failed to mark as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const response = await apiClient.post('/v1/notifications/read-all');
      if (response.success) {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      }
    } catch (error) {
      console.error('[notificationStore] Failed to mark all as read:', error);
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.read ? state.unreadCount : state.unreadCount + 1,
    }));
  },

  reset: () => set(initialState),
}));

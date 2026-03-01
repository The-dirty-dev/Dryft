import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { DARK_THEME_COLORS } from '../theme/ThemeProvider';

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | 'new_match'
  | 'new_message'
  | 'new_like'
  | 'super_like'
  | 'profile_view'
  | 'match_expiring'
  | 'date_reminder'
  | 'safety_check'
  | 'promotion'
  | 'system'
  | 'achievement';

export type NotificationPriority = 'high' | 'normal' | 'low';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, any>;
  priority: NotificationPriority;
  isRead: boolean;
  isActioned: boolean;
  createdAt: string;
  expiresAt?: string;
  deepLink?: string;
}

export interface NotificationGroup {
  date: string;
  label: string;
  notifications: Notification[];
}

export interface NotificationPreferences {
  enabled: boolean;
  newMatches: boolean;
  messages: boolean;
  likes: boolean;
  superLikes: boolean;
  profileViews: boolean;
  promotions: boolean;
  reminders: boolean;
  sound: boolean;
  vibration: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  NOTIFICATIONS: 'dryft_notifications',
  PREFERENCES: 'dryft_notification_preferences',
  LAST_READ: 'dryft_notification_last_read',
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  newMatches: true,
  messages: true,
  likes: true,
  superLikes: true,
  profileViews: true,
  promotions: false,
  reminders: true,
  sound: true,
  vibration: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

// ============================================================================
// Notification Center Service
// ============================================================================

class NotificationCenterService {
  private static instance: NotificationCenterService;
  private notifications: Notification[] = [];
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES;
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): NotificationCenterService {
    if (!NotificationCenterService.instance) {
      NotificationCenterService.instance = new NotificationCenterService();
    }
    return NotificationCenterService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadNotifications(),
      this.loadPreferences(),
    ]);

    this.initialized = true;
    console.log('[NotificationCenter] Initialized');
  }

  private async loadNotifications(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (stored) {
        this.notifications = JSON.parse(stored);
        // Remove expired notifications
        this.notifications = this.notifications.filter((n) => {
          if (n.expiresAt) {
            return new Date(n.expiresAt) > new Date();
          }
          return true;
        });
      }
    } catch (error) {
      console.error('[NotificationCenter] Failed to load notifications:', error);
    }
  }

  private async saveNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.NOTIFICATIONS,
        JSON.stringify(this.notifications)
      );
    } catch (error) {
      console.error('[NotificationCenter] Failed to save notifications:', error);
    }
  }

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[NotificationCenter] Failed to load preferences:', error);
    }
  }

  // ==========================================================================
  // Notifications Management
  // ==========================================================================

  async addNotification(notification: Omit<Notification, 'id' | 'isRead' | 'isActioned' | 'createdAt'>): Promise<void> {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isRead: false,
      isActioned: false,
      createdAt: new Date().toISOString(),
    };

    this.notifications.unshift(newNotification);

    // Keep max 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }

    await this.saveNotifications();
    this.notifyListeners();
  }

  async fetchFromServer(): Promise<void> {
    try {
      const response = await api.get<{ notifications: Notification[] }>(
        '/v1/notifications'
      );

      // Merge with local notifications
      const serverIds = new Set(response.data!.notifications.map((n) => n.id));
      const localOnly = this.notifications.filter((n) => !serverIds.has(n.id));

      this.notifications = [
        ...response.data!.notifications,
        ...localOnly,
      ].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      await this.saveNotifications();
      this.notifyListeners();
    } catch (error) {
      console.error('[NotificationCenter] Failed to fetch notifications:', error);
    }
  }

  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  getGroupedNotifications(): NotificationGroup[] {
    const groups: Map<string, Notification[]> = new Map();
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    for (const notification of this.notifications) {
      const date = new Date(notification.createdAt);
      const dateString = date.toDateString();

      let label: string;
      if (dateString === today) {
        label = 'Today';
      } else if (dateString === yesterday) {
        label = 'Yesterday';
      } else if (now.getTime() - date.getTime() < 7 * 86400000) {
        label = 'This Week';
      } else {
        label = 'Earlier';
      }

      const key = `${label}_${dateString}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(notification);
    }

    const result: NotificationGroup[] = [];
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];

    for (const prefix of order) {
      for (const [key, notifications] of groups) {
        if (key.startsWith(prefix)) {
          result.push({
            date: key.split('_')[1],
            label: prefix,
            notifications,
          });
        }
      }
    }

    return result;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      await this.saveNotifications();
      this.notifyListeners();

      // Sync with server
      api.post('/v1/notifications/read', { notification_id: notificationId }).catch(() => {});
    }
  }

  async markAllAsRead(): Promise<void> {
    this.notifications.forEach((n) => (n.isRead = true));
    await this.saveNotifications();
    this.notifyListeners();

    // Sync with server
    api.post('/v1/notifications/read-all').catch(() => {});
  }

  async markAsActioned(notificationId: string): Promise<void> {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.isActioned = true;
      notification.isRead = true;
      await this.saveNotifications();
      this.notifyListeners();
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    this.notifications = this.notifications.filter((n) => n.id !== notificationId);
    await this.saveNotifications();
    this.notifyListeners();
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
    await this.saveNotifications();
    this.notifyListeners();
  }

  // ==========================================================================
  // Preferences
  // ==========================================================================

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  async updatePreferences(updates: Partial<NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...updates };
    await AsyncStorage.setItem(
      STORAGE_KEYS.PREFERENCES,
      JSON.stringify(this.preferences)
    );

    // Sync with server
    api.post('/v1/notifications/preferences', this.preferences).catch(() => {});
  }

  isNotificationTypeEnabled(type: NotificationType): boolean {
    if (!this.preferences.enabled) return false;

    switch (type) {
      case 'new_match':
        return this.preferences.newMatches;
      case 'new_message':
        return this.preferences.messages;
      case 'new_like':
        return this.preferences.likes;
      case 'super_like':
        return this.preferences.superLikes;
      case 'profile_view':
        return this.preferences.profileViews;
      case 'promotion':
        return this.preferences.promotions;
      case 'date_reminder':
      case 'match_expiring':
        return this.preferences.reminders;
      default:
        return true;
    }
  }

  isQuietHours(): boolean {
    if (!this.preferences.quietHoursEnabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = this.preferences.quietHoursEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Spans midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getNotificationIcon(type: NotificationType): string {
    switch (type) {
      case 'new_match':
        return 'heart';
      case 'new_message':
        return 'chatbubble';
      case 'new_like':
        return 'heart-outline';
      case 'super_like':
        return 'star';
      case 'profile_view':
        return 'eye';
      case 'match_expiring':
        return 'time';
      case 'date_reminder':
        return 'calendar';
      case 'safety_check':
        return 'shield-checkmark';
      case 'promotion':
        return 'gift';
      case 'achievement':
        return 'trophy';
      case 'system':
      default:
        return 'notifications';
    }
  }

  getNotificationColor(type: NotificationType): string {
    switch (type) {
      case 'new_match':
        return DARK_THEME_COLORS.success;
      case 'new_message':
        return DARK_THEME_COLORS.accent;
      case 'new_like':
        return DARK_THEME_COLORS.accentPink;
      case 'super_like':
        return DARK_THEME_COLORS.warning;
      case 'profile_view':
        return DARK_THEME_COLORS.accentSecondary;
      case 'match_expiring':
        return DARK_THEME_COLORS.error;
      case 'date_reminder':
        return DARK_THEME_COLORS.info;
      case 'safety_check':
        return DARK_THEME_COLORS.success;
      case 'promotion':
        return DARK_THEME_COLORS.primaryLight;
      case 'achievement':
        return DARK_THEME_COLORS.accentYellow;
      case 'system':
      default:
        return DARK_THEME_COLORS.textMuted;
    }
  }
}

export const notificationCenterService = NotificationCenterService.getInstance();
export default notificationCenterService;

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { DARK_THEME_COLORS } from '../theme/ThemeProvider';

/**
 * Notification service for push registration and in-app handling.
 * Wraps Expo Notifications and backend device registration.
 * @example
 * await registerForPushNotificationsAsync();
 */
// ============================================================================
// Types and Constants
// ============================================================================

export type NotificationType =
  | 'new_match'
  | 'new_message'
  | 'new_like'
  | 'super_like'
  | 'profile_view'
  | 'vr_invite'
  | 'vr_session_started'
  | 'vr_session_ended'
  | 'vr_entered_booth'
  | 'vr_haptic_ping'
  | 'companion_joined'
  | 'companion_left'
  | 'verification_approved'
  | 'verification_rejected'
  | 'safety_alert'
  | 'subscription_expiring'
  | 'promotion'
  | 'system';

export interface NotificationData {
  type: NotificationType;
  match_id?: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  message_preview?: string;
  session_code?: string;
  partner_name?: string;
  haptic_intensity?: number;
  image_url?: string;
  action?: string;
  deep_link?: string;
  category?: NotificationCategory;
  [key: string]: string | number | undefined;
}

// Notification categories
export type NotificationCategory =
  | 'MESSAGE'
  | 'MATCH'
  | 'LIKE'
  | 'SUPER_LIKE'
  | 'VR_INVITE'
  | 'PROFILE_VIEW'
  | 'SAFETY'
  | 'SYSTEM'
  | 'PROMO';

// Action identifiers
export type NotificationAction =
  | 'REPLY'
  | 'MARK_READ'
  | 'LIKE_BACK'
  | 'PASS'
  | 'SAY_HI'
  | 'VIEW_PROFILE'
  | 'JOIN_VR'
  | 'DECLINE_VR'
  | 'BLOCK'
  | 'REPORT'
  | 'DISMISS';

// Settings keys
const SETTINGS_KEYS = {
  NOTIFICATIONS_ENABLED: 'dryft_notifications_enabled',
  QUIET_HOURS_ENABLED: 'dryft_quiet_hours_enabled',
  QUIET_HOURS_START: 'dryft_quiet_hours_start',
  QUIET_HOURS_END: 'dryft_quiet_hours_end',
  CATEGORY_SETTINGS: 'dryft_notification_category_settings',
  SOUND_ENABLED: 'dryft_notification_sound',
  VIBRATION_ENABLED: 'dryft_notification_vibration',
  PREVIEW_ENABLED: 'dryft_notification_preview',
};

// Default category settings
export interface CategorySettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  showPreview: boolean;
}

const DEFAULT_CATEGORY_SETTINGS: Record<NotificationCategory, CategorySettings> = {
  MESSAGE: { enabled: true, sound: true, vibration: true, showPreview: true },
  MATCH: { enabled: true, sound: true, vibration: true, showPreview: true },
  LIKE: { enabled: true, sound: true, vibration: false, showPreview: true },
  SUPER_LIKE: { enabled: true, sound: true, vibration: true, showPreview: true },
  VR_INVITE: { enabled: true, sound: true, vibration: true, showPreview: true },
  PROFILE_VIEW: { enabled: true, sound: false, vibration: false, showPreview: false },
  SAFETY: { enabled: true, sound: true, vibration: true, showPreview: true },
  SYSTEM: { enabled: true, sound: false, vibration: false, showPreview: true },
  PROMO: { enabled: true, sound: false, vibration: false, showPreview: true },
};

// Android notification channels
const ANDROID_CHANNELS = {
  messages: {
    id: 'messages',
    name: 'Messages',
    description: 'New message notifications',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'message.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: DARK_THEME_COLORS.primary,
    enableVibrate: true,
    enableLights: true,
  },
  matches: {
    id: 'matches',
    name: 'Matches',
    description: 'New match notifications',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'match.wav',
    vibrationPattern: [0, 500, 250, 500],
    lightColor: DARK_THEME_COLORS.primary,
    enableVibrate: true,
    enableLights: true,
  },
  likes: {
    id: 'likes',
    name: 'Likes',
    description: 'Like and super like notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'like.wav',
    lightColor: DARK_THEME_COLORS.accentPink,
    enableVibrate: true,
    enableLights: true,
  },
  vr_sessions: {
    id: 'vr_sessions',
    name: 'VR Sessions',
    description: 'VR companion session notifications',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'vr_invite.wav',
    vibrationPattern: [0, 500, 250, 500],
    lightColor: DARK_THEME_COLORS.accent,
    enableVibrate: true,
    enableLights: true,
  },
  haptics: {
    id: 'haptics',
    name: 'Haptic Alerts',
    description: 'Haptic feedback notifications from VR',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 100, 100, 100, 100],
    enableVibrate: true,
    enableLights: false,
  },
  safety: {
    id: 'safety',
    name: 'Safety Alerts',
    description: 'Important safety notifications',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'alert.wav',
    vibrationPattern: [0, 300, 200, 300, 200, 300],
    lightColor: DARK_THEME_COLORS.error,
    enableVibrate: true,
    enableLights: true,
    bypassDnd: true,
  },
  system: {
    id: 'system',
    name: 'System',
    description: 'System and account notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
    enableLights: false,
  },
  promotions: {
    id: 'promotions',
    name: 'Promotions',
    description: 'Special offers and promotions',
    importance: Notifications.AndroidImportance.LOW,
    enableVibrate: false,
    enableLights: false,
  },
};

// ============================================================================
// Configure notification behavior
// ============================================================================

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as NotificationData;
    const category = data?.category || getDefaultCategory(data?.type);

    // Check if in quiet hours
    const inQuietHours = await NotificationService.getInstance().isInQuietHours();
    if (inQuietHours && category !== 'SAFETY') {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
      };
    }

    // Get category settings
    const settings = await NotificationService.getInstance().getCategorySettings(category);

    return {
      shouldShowAlert: settings.enabled,
      shouldPlaySound: settings.enabled && settings.sound,
      shouldSetBadge: true,
    };
  },
});

function getDefaultCategory(type?: NotificationType): NotificationCategory {
  switch (type) {
    case 'new_message':
      return 'MESSAGE';
    case 'new_match':
      return 'MATCH';
    case 'new_like':
      return 'LIKE';
    case 'super_like':
      return 'SUPER_LIKE';
    case 'vr_invite':
    case 'vr_session_started':
    case 'vr_entered_booth':
      return 'VR_INVITE';
    case 'profile_view':
      return 'PROFILE_VIEW';
    case 'safety_alert':
      return 'SAFETY';
    case 'promotion':
      return 'PROMO';
    default:
      return 'SYSTEM';
  }
}

// ============================================================================
// Notification Service
// ============================================================================

class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private actionHandler: ((action: NotificationAction, data: NotificationData, input?: string) => void) | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void,
    onAction?: (action: NotificationAction, data: NotificationData, input?: string) => void
  ): Promise<void> {
    this.actionHandler = onAction || null;

    // Request permissions
    const token = await this.registerForPushNotifications();

    if (token) {
      await this.registerTokenWithBackend(token);
    }

    // Set up notification categories with actions
    await this.setupNotificationCategories();

    // Set up listeners
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Notifications] Received:', notification);
        this.handleNotificationReceived(notification);
        onNotificationReceived?.(notification);
      }
    );

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[Notifications] Response:', response);
        this.handleNotificationResponse(response);
        onNotificationResponse?.(response);
      }
    );
  }

  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
    this.actionHandler = null;
  }

  // ==========================================================================
  // Push Token Registration
  // ==========================================================================

  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('[Notifications] Must use physical device for push notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: true,
          provideAppNotificationSettings: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      this.expoPushToken = token.data;
      console.log('[Notifications] Token:', this.expoPushToken);

      // Set up Android channels
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('[Notifications] Error getting token:', error);
      return null;
    }
  }

  private async setupAndroidChannels(): Promise<void> {
    for (const channel of Object.values(ANDROID_CHANNELS)) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: channel.importance,
        sound: channel.sound,
        vibrationPattern: channel.vibrationPattern,
        lightColor: channel.lightColor,
        enableVibrate: channel.enableVibrate,
        enableLights: channel.enableLights,
        bypassDnd: channel.bypassDnd,
      });
    }
  }

  // ==========================================================================
  // Notification Categories with Actions
  // ==========================================================================

  private async setupNotificationCategories(): Promise<void> {
    if (Platform.OS === 'ios') {
      await this.setupIOSCategories();
    }
  }

  private async setupIOSCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('MESSAGE', [
      {
        identifier: 'REPLY',
        buttonTitle: 'Reply',
        options: {
          opensAppToForeground: false,
        },
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a message...',
        },
      },
      {
        identifier: 'MARK_READ',
        buttonTitle: 'Mark as Read',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('MATCH', [
      {
        identifier: 'SAY_HI',
        buttonTitle: 'Say Hi 👋',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'VIEW_PROFILE',
        buttonTitle: 'View Profile',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('LIKE', [
      {
        identifier: 'LIKE_BACK',
        buttonTitle: 'Like Back ❤️',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'VIEW_PROFILE',
        buttonTitle: 'View',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'PASS',
        buttonTitle: 'Pass',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('SUPER_LIKE', [
      {
        identifier: 'LIKE_BACK',
        buttonTitle: 'Like Back ❤️',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'SAY_HI',
        buttonTitle: 'Say Hi 👋',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'VIEW_PROFILE',
        buttonTitle: 'View',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('VR_INVITE', [
      {
        identifier: 'JOIN_VR',
        buttonTitle: 'Join Session',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'DECLINE_VR',
        buttonTitle: 'Decline',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('PROFILE_VIEW', [
      {
        identifier: 'VIEW_PROFILE',
        buttonTitle: 'View Back',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'LIKE_BACK',
        buttonTitle: 'Like ❤️',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('SAFETY', [
      {
        identifier: 'BLOCK',
        buttonTitle: 'Block User',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
      {
        identifier: 'REPORT',
        buttonTitle: 'Report',
        options: {
          opensAppToForeground: true,
          isDestructive: true,
        },
      },
      {
        identifier: 'DISMISS',
        buttonTitle: 'Dismiss',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
  }

  // ==========================================================================
  // Notification Handling
  // ==========================================================================

  private handleNotificationReceived(notification: Notifications.Notification): void {
    const data = notification.request.content.data as NotificationData;

    // Handle haptic notifications
    if (data?.type === 'vr_haptic_ping') {
      this.handleHapticNotification(data.haptic_intensity || 0.5);
    }
  }

  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data as NotificationData;
    const actionId = response.actionIdentifier;

    // Handle text input for reply action
    let inputText: string | undefined;
    if ('userText' in response && typeof response.userText === 'string') {
      inputText = response.userText;
    }

    // Handle default tap (open notification)
    if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // Navigation will be handled by the callback
      return;
    }

    // Handle specific actions
    if (this.actionHandler && isValidAction(actionId)) {
      this.actionHandler(actionId as NotificationAction, data, inputText);
    }
  }

  async handleHapticNotification(intensity: number = 0.5): Promise<void> {
    const pattern = this.getVibrationPattern(intensity);

    if (Platform.OS === 'android') {
      Vibration.vibrate(pattern);
    } else {
      Vibration.vibrate();
    }
  }

  private getVibrationPattern(intensity: number): number[] {
    if (intensity < 0.3) {
      return [0, 100];
    } else if (intensity < 0.6) {
      return [0, 200, 100, 200];
    } else {
      return [0, 300, 100, 300, 100, 300];
    }
  }

  // ==========================================================================
  // Navigation
  // ==========================================================================

  handleNotificationNavigation(
    data: NotificationData,
    navigate: (screen: string, params?: object) => void
  ): void {
    // Handle deep link if present
    if (data.deep_link) {
      // Deep link handling delegated to deep link service
      return;
    }

    switch (data.type) {
      case 'new_match':
        navigate('MatchDetail', { matchId: data.match_id, userId: data.user_id });
        break;

      case 'new_message':
        if (data.match_id) {
          navigate('Chat', { matchId: data.match_id });
        } else {
          navigate('Messages');
        }
        break;

      case 'new_like':
      case 'super_like':
        navigate('Likes', { userId: data.user_id });
        break;

      case 'profile_view':
        if (data.user_id) {
          navigate('Profile', { userId: data.user_id });
        } else {
          navigate('ProfileViews');
        }
        break;

      case 'vr_invite':
      case 'vr_session_started':
        if (data.session_code) {
          navigate('Companion', { sessionCode: data.session_code });
        } else {
          navigate('Companion');
        }
        break;

      case 'vr_entered_booth':
        if (data.session_code) {
          navigate('Companion', {
            sessionCode: data.session_code,
            inBooth: true,
            partnerName: data.partner_name,
          });
        }
        break;

      case 'vr_haptic_ping':
        if (data.session_code) {
          navigate('Companion', {
            sessionCode: data.session_code,
            triggerHaptic: true,
            hapticIntensity: data.haptic_intensity,
          });
        }
        break;

      case 'companion_joined':
      case 'companion_left':
        navigate('Companion');
        break;

      case 'verification_approved':
      case 'verification_rejected':
        navigate('VerificationStatus');
        break;

      case 'safety_alert':
        navigate('Safety', { alertId: data.action });
        break;

      case 'subscription_expiring':
        navigate('Subscription');
        break;

      case 'promotion':
        navigate('Promotions', { promoId: data.action });
        break;

      case 'system':
        if (data.action === 'open_verification') {
          navigate('Verification');
        } else if (data.action === 'open_settings') {
          navigate('Settings');
        }
        break;

      default:
        break;
    }
  }

  // ==========================================================================
  // Backend Registration
  // ==========================================================================

  async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const deviceId = Constants.deviceId || Device.modelId || 'unknown';
      const appVersion = Constants.expoConfig?.version || '1.0.0';

      await api.post('/v1/notifications/devices', {
        token,
        platform: Platform.OS,
        device_id: deviceId,
        app_version: appVersion,
        device_name: Device.deviceName,
        os_version: Device.osVersion,
      });

      console.log('[Notifications] Token registered with backend');
    } catch (error) {
      console.error('[Notifications] Failed to register token:', error);
    }
  }

  async unregister(): Promise<void> {
    const deviceId = Constants.deviceId || Device.modelId || 'unknown';

    try {
      await api.delete(`/v1/notifications/devices/${deviceId}`);
      console.log('[Notifications] Token unregistered');
    } catch (error) {
      console.error('[Notifications] Failed to unregister token:', error);
    }

    this.cleanup();
  }

  getToken(): string | null {
    return this.expoPushToken;
  }

  // ==========================================================================
  // Settings Management
  // ==========================================================================

  async isInQuietHours(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(SETTINGS_KEYS.QUIET_HOURS_ENABLED);
      if (enabled !== 'true') return false;

      const startStr = await AsyncStorage.getItem(SETTINGS_KEYS.QUIET_HOURS_START);
      const endStr = await AsyncStorage.getItem(SETTINGS_KEYS.QUIET_HOURS_END);

      if (!startStr || !endStr) return false;

      const start = parseInt(startStr, 10); // Minutes from midnight
      const end = parseInt(endStr, 10);

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (start < end) {
        return currentMinutes >= start && currentMinutes < end;
      } else {
        // Wraps around midnight
        return currentMinutes >= start || currentMinutes < end;
      }
    } catch {
      return false;
    }
  }

  async setQuietHours(enabled: boolean, start?: number, end?: number): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEYS.QUIET_HOURS_ENABLED, enabled ? 'true' : 'false');
    if (start !== undefined) {
      await AsyncStorage.setItem(SETTINGS_KEYS.QUIET_HOURS_START, start.toString());
    }
    if (end !== undefined) {
      await AsyncStorage.setItem(SETTINGS_KEYS.QUIET_HOURS_END, end.toString());
    }
  }

  async getQuietHours(): Promise<{ enabled: boolean; start: number; end: number }> {
    const enabled = (await AsyncStorage.getItem(SETTINGS_KEYS.QUIET_HOURS_ENABLED)) === 'true';
    const start = parseInt((await AsyncStorage.getItem(SETTINGS_KEYS.QUIET_HOURS_START)) || '1320', 10); // 10pm
    const end = parseInt((await AsyncStorage.getItem(SETTINGS_KEYS.QUIET_HOURS_END)) || '420', 10); // 7am
    return { enabled, start, end };
  }

  async getCategorySettings(category: NotificationCategory): Promise<CategorySettings> {
    try {
      const settingsStr = await AsyncStorage.getItem(SETTINGS_KEYS.CATEGORY_SETTINGS);
      if (!settingsStr) return DEFAULT_CATEGORY_SETTINGS[category];

      const allSettings = JSON.parse(settingsStr);
      return allSettings[category] || DEFAULT_CATEGORY_SETTINGS[category];
    } catch {
      return DEFAULT_CATEGORY_SETTINGS[category];
    }
  }

  async setCategorySettings(
    category: NotificationCategory,
    settings: Partial<CategorySettings>
  ): Promise<void> {
    try {
      const settingsStr = await AsyncStorage.getItem(SETTINGS_KEYS.CATEGORY_SETTINGS);
      const allSettings = settingsStr ? JSON.parse(settingsStr) : {};

      allSettings[category] = {
        ...(allSettings[category] || DEFAULT_CATEGORY_SETTINGS[category]),
        ...settings,
      };

      await AsyncStorage.setItem(SETTINGS_KEYS.CATEGORY_SETTINGS, JSON.stringify(allSettings));
    } catch (error) {
      console.error('[Notifications] Failed to save category settings:', error);
    }
  }

  async getAllCategorySettings(): Promise<Record<NotificationCategory, CategorySettings>> {
    try {
      const settingsStr = await AsyncStorage.getItem(SETTINGS_KEYS.CATEGORY_SETTINGS);
      if (!settingsStr) return { ...DEFAULT_CATEGORY_SETTINGS };

      const savedSettings = JSON.parse(settingsStr);
      return {
        ...DEFAULT_CATEGORY_SETTINGS,
        ...savedSettings,
      };
    } catch {
      return { ...DEFAULT_CATEGORY_SETTINGS };
    }
  }

  // ==========================================================================
  // Badge Management
  // ==========================================================================

  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async incrementBadge(): Promise<void> {
    const current = await this.getBadgeCount();
    await this.setBadgeCount(current + 1);
  }

  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  async clearAll(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    await this.clearBadge();
  }

  // ==========================================================================
  // Local Notifications
  // ==========================================================================

  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Partial<NotificationData>,
    options?: {
      seconds?: number;
      categoryId?: NotificationCategory;
      channelId?: string;
      attachments?: Array<{ url: string; identifier?: string }>;
    }
  ): Promise<string> {
    const content: Notifications.NotificationContentInput = {
      title,
      body,
      data,
      sound: true,
      categoryIdentifier: options?.categoryId,
    };

    // Add attachments for rich notifications (iOS)
    if (Platform.OS === 'ios' && options?.attachments) {
      content.attachments = options.attachments;
    }

    // Set Android channel
    if (Platform.OS === 'android') {
      content.channelId = options?.channelId || 'default';
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger: options?.seconds ? { seconds: options.seconds } : null,
    });

    return identifier;
  }

  async sendMessageNotification(
    senderName: string,
    message: string,
    matchId: string,
    senderAvatar?: string
  ): Promise<string> {
    const attachments = senderAvatar
      ? [{ url: senderAvatar, identifier: 'avatar' }]
      : undefined;

    return this.scheduleLocalNotification(
      senderName,
      message,
      {
        type: 'new_message',
        match_id: matchId,
        user_name: senderName,
        message_preview: message,
        category: 'MESSAGE',
      },
      {
        categoryId: 'MESSAGE',
        channelId: 'messages',
        attachments,
      }
    );
  }

  async sendMatchNotification(
    matchName: string,
    matchId: string,
    userId: string,
    avatarUrl?: string
  ): Promise<string> {
    const attachments = avatarUrl
      ? [{ url: avatarUrl, identifier: 'avatar' }]
      : undefined;

    return this.scheduleLocalNotification(
      "It's a Match! 🎉",
      `You and ${matchName} liked each other`,
      {
        type: 'new_match',
        match_id: matchId,
        user_id: userId,
        user_name: matchName,
        category: 'MATCH',
      },
      {
        categoryId: 'MATCH',
        channelId: 'matches',
        attachments,
      }
    );
  }

  async sendLikeNotification(
    likerName: string,
    userId: string,
    isSuperLike: boolean = false,
    avatarUrl?: string
  ): Promise<string> {
    const attachments = avatarUrl
      ? [{ url: avatarUrl, identifier: 'avatar' }]
      : undefined;

    const title = isSuperLike ? `${likerName} Super Liked you! ⭐` : `${likerName} liked you`;
    const body = isSuperLike
      ? 'They really want to meet you!'
      : 'Swipe right to match';

    return this.scheduleLocalNotification(
      title,
      body,
      {
        type: isSuperLike ? 'super_like' : 'new_like',
        user_id: userId,
        user_name: likerName,
        category: isSuperLike ? 'SUPER_LIKE' : 'LIKE',
      },
      {
        categoryId: isSuperLike ? 'SUPER_LIKE' : 'LIKE',
        channelId: 'likes',
        attachments,
      }
    );
  }

  async sendVRInviteNotification(
    inviterName: string,
    sessionCode: string,
    avatarUrl?: string
  ): Promise<string> {
    const attachments = avatarUrl
      ? [{ url: avatarUrl, identifier: 'avatar' }]
      : undefined;

    return this.scheduleLocalNotification(
      `${inviterName} invited you to VR`,
      'Tap to join their VR session',
      {
        type: 'vr_invite',
        session_code: sessionCode,
        partner_name: inviterName,
        category: 'VR_INVITE',
      },
      {
        categoryId: 'VR_INVITE',
        channelId: 'vr_sessions',
        attachments,
      }
    );
  }
}

// Helper function to validate action identifiers
function isValidAction(action: string): action is NotificationAction {
  const validActions: NotificationAction[] = [
    'REPLY',
    'MARK_READ',
    'LIKE_BACK',
    'PASS',
    'SAY_HI',
    'VIEW_PROFILE',
    'JOIN_VR',
    'DECLINE_VR',
    'BLOCK',
    'REPORT',
    'DISMISS',
  ];
  return validActions.includes(action as NotificationAction);
}

export const notificationService = NotificationService.getInstance();
export default notificationService;

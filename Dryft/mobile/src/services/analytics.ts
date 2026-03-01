import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';

/**
 * Analytics service for tracking app events, sessions, and attribution.
 * Exposes helpers for screen tracking, engagement metrics, and error reporting.
 * @example
 * trackEvent('app_open');
 */
// ============================================================================
// Event Types
// ============================================================================

export type AnalyticsEventName =
  // App Lifecycle
  | 'app_open'
  | 'app_close'
  | 'app_background'
  | 'app_foreground'
  | 'first_open'
  | 'session_start'
  | 'session_end'
  // Auth Events
  | 'sign_up'
  | 'sign_up_start'
  | 'sign_up_complete'
  | 'login'
  | 'logout'
  | 'password_reset'
  | 'account_deleted'
  // Onboarding Events
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  // Discovery Events
  | 'profile_viewed'
  | 'profile_liked'
  | 'profile_passed'
  | 'profile_super_liked'
  | 'match_created'
  | 'match_unmatched'
  | 'card_view'
  | 'profile_expand'
  // Chat Events
  | 'chat_opened'
  | 'message_sent'
  | 'message_received'
  | 'media_sent'
  | 'media_received'
  | 'first_message'
  // Call Events
  | 'call_started'
  | 'call_answered'
  | 'call_ended'
  | 'call_missed'
  // VR Events
  | 'vr_session_started'
  | 'vr_session_ended'
  | 'vr_session_joined'
  | 'vr_booth_entered'
  | 'vr_booth_exited'
  | 'vr_lounge_joined'
  | 'vr_interaction'
  | 'companion_connected'
  | 'companion_disconnected'
  // Safety Events
  | 'panic_button_pressed'
  | 'user_blocked'
  | 'user_reported'
  | 'user_unblocked'
  | 'safety_check_in'
  // Store Events
  | 'store_viewed'
  | 'item_viewed'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'paywall_viewed'
  // Verification
  | 'verification_started'
  | 'verification_completed'
  | 'verification_failed'
  // Settings Events
  | 'settings_changed'
  | 'notification_settings_changed'
  | 'privacy_settings_changed'
  // Haptic Events
  | 'haptic_device_connected'
  | 'haptic_device_disconnected'
  | 'haptic_signal_sent'
  | 'haptic_signal_received'
  // Navigation Events
  | 'screen_view'
  | 'tab_changed'
  | 'deep_link_opened'
  // Features
  | 'boost_activated'
  | 'spotlight_activated'
  | 'rewind_used'
  | 'filter_changed'
  // Error Events
  | 'error_occurred'
  | 'crash_detected'
  | 'api_error'
  // Performance Events
  | 'screen_load_time'
  | 'api_response_time'
  | 'image_load_time'
  // Share / Quick Action Events
  | 'link_copied'
  | 'quick_action_handled'
  | 'quick_action_used'
  | 'content_shared'
  // Voice / Media Events
  | 'voice_recording_started'
  | 'voice_recording_completed'
  | 'voice_recording_cancelled'
  | 'voice_message_uploaded'
  | 'chat_media_uploaded'
  | 'chat_image_picked'
  | 'chat_image_taken'
  // Story Events
  | 'story_created'
  | 'story_deleted'
  | 'story_viewed'
  | 'story_liked'
  | 'story_replied'
  // Gift Events
  | 'gift_purchased'
  | 'gift_sent'
  | 'gift_thanked'
  // Profile Events
  | 'profile_favorited'
  | 'profile_unfavorited'
  // Icebreaker Events
  | 'icebreaker_used'
  | 'icebreaker_created'
  | 'icebreaker_got_response'
  // Boost / Subscription Events
  | 'boost_expired'
  | 'free_boost_used'
  | 'subscription_updated'
  | 'restore_purchases_started'
  | 'restore_purchases_completed'
  | 'restore_purchases_failed'
  // Creator / Payout Events
  | 'creator_goal_created'
  | 'payout_requested'
  | 'payout_method_updated'
  // 2FA Events
  | '2fa_sms_setup_started'
  | '2fa_sms_enabled'
  | '2fa_email_setup_started'
  | '2fa_email_enabled'
  | '2fa_authenticator_setup_started'
  | '2fa_authenticator_enabled'
  | '2fa_method_disabled'
  | '2fa_disabled_all'
  | '2fa_verification_failed'
  | '2fa_verified'
  | 'backup_codes_regenerated'
  | 'backup_code_used'
  // Biometric Events
  | 'biometric_enabled'
  | 'biometric_disabled'
  | 'biometric_auth_success'
  | 'biometric_auth_failed'
  // Verification Events
  | 'verification_session_started'
  | 'photo_verification_submitted'
  | 'id_verification_submitted'
  // Accessibility / Settings Events
  | 'accessibility_changed'
  | 'accessibility_preference_changed'
  | 'accessibility_preferences_reset'
  | 'language_changed'
  | 'location_settings_updated'
  | 'notification_settings_changed'
  // Safety Events
  | 'safety_check_scheduled'
  | 'safety_check_confirmed'
  | 'emergency_alert_triggered'
  | 'emergency_contact_added'
  | 'emergency_contact_removed'
  | 'emergency_services_called'
  | 'message_reported'
  | 'user_muted'
  | 'user_unmuted'
  // Offline / Network Events
  | 'network_lost'
  | 'network_restored'
  | 'offline_action_failed'
  | 'offline_queue_synced'
  | 'background_sync_completed'
  | 'cache_cleared'
  // Filter / Discovery Events
  | 'discovery_filters_updated'
  | 'discovery_filters_reset'
  | 'filter_preset_created'
  | 'filter_preset_applied'
  | 'map_filters_updated'
  // Deep Link Events
  | 'deep_link_received'
  | 'deferred_deep_link_restored'
  // Campaign / Attribution Events
  | 'campaign_attributed'
  // Update Events
  | 'update_check_completed'
  | 'update_store_opened'
  | 'update_skipped'
  | 'update_remind_later'
  // Feedback / Misc
  | 'feedback_submitted'
  | 'favorite_collection_created'
  | 'achievement_reward_claimed';

export type EventCategory =
  | 'lifecycle'
  | 'engagement'
  | 'conversion'
  | 'social'
  | 'vr'
  | 'error'
  | 'performance'
  | 'revenue'
  | 'navigation';

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  category?: EventCategory;
  properties?: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

export interface UserProperties {
  userId?: string;
  email?: string;
  isVerified?: boolean;
  hasVR?: boolean;
  subscriptionTier?: string;
  signUpDate?: string;
  matchCount?: number;
  vrSessionCount?: number;
  platform?: string;
  appVersion?: string;
  deviceModel?: string;
  ageRange?: string;
  gender?: string;
}

interface SessionData {
  id: string;
  startTime: number;
  endTime?: number;
  screenViews: number;
  events: number;
  screens: string[];
  engagementTime: number;
}

interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  batchSize: number;
  flushInterval: number;
  endpoint: string;
  sampleRate: number;
  sessionTimeout: number;
  trackCrashes: boolean;
  trackPerformance: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  QUEUE: 'dryft_analytics_queue',
  USER_ID: 'dryft_analytics_user_id',
  USER_PROPS: 'dryft_analytics_user_props',
  SESSION_ID: 'dryft_analytics_session_id',
  SESSION_START: 'dryft_analytics_session_start',
  DEVICE_ID: 'dryft_analytics_device_id',
  TOTAL_SESSIONS: 'dryft_analytics_total_sessions',
  FIRST_OPEN: 'dryft_analytics_first_open',
  CONSENT: 'dryft_analytics_consent',
  CRASH_LOG: 'dryft_analytics_crash_log',
};

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  debug: __DEV__,
  batchSize: 20,
  flushInterval: 30000, // 30 seconds
  endpoint: '/v1/analytics/events',
  sampleRate: 1.0, // 100% of events
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  trackCrashes: true,
  trackPerformance: true,
};

// ============================================================================
// Analytics Service
// ============================================================================

class AnalyticsService {
  private static instance: AnalyticsService;
  private config: AnalyticsConfig;
  private sessionId: string;
  private userId: string | null = null;
  private deviceId: string | null = null;
  private userProperties: UserProperties = {};
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private sessionStartTime: number;
  private sessionData: SessionData | null = null;
  private screenStack: string[] = [];
  private currentScreen: string | null = null;
  private screenStartTime: number | null = null;
  private consentGiven = true;
  private appStateSubscription: any = null;

  // Performance tracking
  private timingEvents: Map<string, number> = new Map();
  private performanceMarks: Map<string, number> = new Map();

  // Error tracking
  private errorCount = 0;
  private lastError: Error | null = null;

  private constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
  }

  static getInstance(config?: Partial<AnalyticsConfig>): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService(config);
    }
    return AnalyticsService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check consent
      const consent = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT);
      this.consentGiven = consent !== 'false';

      // Get or create device ID
      this.deviceId = await this.getOrCreateDeviceId();

      // Load user ID
      const storedUserId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
      if (storedUserId) {
        this.userId = storedUserId;
      }

      // Load user properties
      const storedProps = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROPS);
      if (storedProps) {
        this.userProperties = JSON.parse(storedProps);
      }

      // Set default device properties
      this.userProperties = {
        ...this.userProperties,
        platform: Platform.OS,
        appVersion: Application.nativeApplicationVersion || Constants.expoConfig?.version || 'unknown',
        deviceModel: Device.modelName || 'unknown',
      };

      // Load persisted events
      await this.loadPersistedEvents();

      // Check for previous crash
      if (this.config.trackCrashes) {
        await this.checkForPreviousCrash();
      }

      // Start session
      await this.startSession();

      // Set up app state listener
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

      // Set up global error handler
      if (this.config.trackCrashes) {
        this.setupErrorHandler();
      }

      // Start flush timer
      this.startFlushTimer();

      // Check if first open
      const firstOpen = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_OPEN);
      if (!firstOpen) {
        await AsyncStorage.setItem(STORAGE_KEYS.FIRST_OPEN, Date.now().toString());
        this.track('first_open', { install_time: Date.now() });
      }

      this.isInitialized = true;
      this.log('Analytics initialized');

      // Track app open
      this.track('app_open');
    } catch (error) {
      console.error('[Analytics] Initialization error:', error);
    }
  }

  private async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }
    return deviceId;
  }

  // ==========================================================================
  // Consent Management
  // ==========================================================================

  async setConsent(granted: boolean): Promise<void> {
    this.consentGiven = granted;
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT, granted ? 'true' : 'false');

    if (!granted) {
      await this.clearAllData();
    }
  }

  getConsent(): boolean {
    return this.consentGiven;
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  private async startSession(): Promise<void> {
    const lastSessionStart = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_START);
    const lastSessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID);

    const now = Date.now();
    const shouldStartNew =
      !lastSessionStart ||
      !lastSessionId ||
      now - parseInt(lastSessionStart, 10) > this.config.sessionTimeout;

    if (shouldStartNew) {
      this.sessionId = this.generateSessionId();
      this.sessionStartTime = now;

      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, this.sessionId);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_START, now.toString());

      // Increment total sessions
      const totalSessions = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SESSIONS);
      const newTotal = (parseInt(totalSessions || '0', 10) + 1).toString();
      await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_SESSIONS, newTotal);

      this.sessionData = {
        id: this.sessionId,
        startTime: now,
        screenViews: 0,
        events: 0,
        screens: [],
        engagementTime: 0,
      };

      this.track('session_start', {
        session_number: parseInt(newTotal, 10),
      });
    } else {
      this.sessionId = lastSessionId!;
      this.sessionStartTime = parseInt(lastSessionStart!, 10);
    }
  }

  private async endSession(): Promise<void> {
    if (!this.sessionData) return;

    this.sessionData.endTime = Date.now();
    const duration = this.sessionData.endTime - this.sessionData.startTime;

    // Calculate engagement time from screen time
    if (this.screenStartTime && this.currentScreen) {
      this.sessionData.engagementTime += Date.now() - this.screenStartTime;
    }

    this.track('session_end', {
      duration_seconds: Math.round(duration / 1000),
      screen_views: this.sessionData.screenViews,
      events_count: this.sessionData.events,
      screens_visited: this.sessionData.screens.length,
      engagement_time_seconds: Math.round(this.sessionData.engagementTime / 1000),
    });

    await this.flush();
  }

  private handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      await this.startSession();
      this.track('app_foreground');
      this.startFlushTimer();

      // Resume screen timing
      if (this.currentScreen) {
        this.screenStartTime = Date.now();
      }
    } else if (nextState === 'background') {
      // Track time on current screen
      if (this.screenStartTime && this.currentScreen && this.sessionData) {
        this.sessionData.engagementTime += Date.now() - this.screenStartTime;
      }

      this.track('app_background');
      await this.endSession();
      this.stopFlushTimer();
    }
  };

  // ==========================================================================
  // Event Tracking
  // ==========================================================================

  track(name: AnalyticsEventName, properties?: Record<string, any>): void {
    if (!this.config.enabled || !this.consentGiven) return;

    // Sample rate check
    if (Math.random() > this.config.sampleRate) return;

    const event: AnalyticsEvent = {
      name,
      properties: {
        ...properties,
        session_duration_ms: Date.now() - this.sessionStartTime,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.eventQueue.push(event);
    this.log('Event tracked:', name, properties);

    if (this.sessionData) {
      this.sessionData.events++;
    }

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  // ==========================================================================
  // Screen Tracking
  // ==========================================================================

  trackScreen(screenName: string, properties?: Record<string, any>): void {
    // Track time on previous screen
    if (this.currentScreen && this.screenStartTime) {
      const timeOnScreen = Date.now() - this.screenStartTime;

      if (this.sessionData) {
        this.sessionData.engagementTime += timeOnScreen;
      }

      this.track('screen_view', {
        screen_name: this.currentScreen,
        time_on_screen_ms: timeOnScreen,
        ...properties,
      });
    }

    const previousScreen = this.screenStack[this.screenStack.length - 1];
    this.screenStack.push(screenName);
    this.currentScreen = screenName;
    this.screenStartTime = Date.now();

    if (this.sessionData) {
      this.sessionData.screenViews++;
      if (!this.sessionData.screens.includes(screenName)) {
        this.sessionData.screens.push(screenName);
      }
    }

    // Track the new screen view
    this.track('screen_view', {
      screen_name: screenName,
      previous_screen: previousScreen,
      screen_depth: this.screenStack.length,
      ...properties,
    });
  }

  trackScreenExit(screenName: string): void {
    const index = this.screenStack.lastIndexOf(screenName);
    if (index !== -1) {
      this.screenStack.splice(index, 1);
    }

    if (this.currentScreen === screenName) {
      this.currentScreen = this.screenStack[this.screenStack.length - 1] || null;
    }
  }

  // ==========================================================================
  // User Identification
  // ==========================================================================

  async identify(userId: string, properties?: Partial<UserProperties>): Promise<void> {
    this.userId = userId;
    await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);

    if (properties) {
      await this.setUserProperties({ ...properties, userId });
    }

    this.log('User identified:', userId);
  }

  async setUserProperties(properties: Partial<UserProperties>): Promise<void> {
    this.userProperties = { ...this.userProperties, ...properties };
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PROPS, JSON.stringify(this.userProperties));
    this.log('User properties updated:', properties);
  }

  async reset(): Promise<void> {
    this.userId = null;
    this.userProperties = {
      platform: Platform.OS,
      appVersion: Application.nativeApplicationVersion || 'unknown',
      deviceModel: Device.modelName || 'unknown',
    };
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.sessionData = null;
    this.screenStack = [];
    this.currentScreen = null;

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_ID,
      STORAGE_KEYS.USER_PROPS,
      STORAGE_KEYS.SESSION_ID,
      STORAGE_KEYS.SESSION_START,
    ]);

    this.log('Analytics reset');
  }

  // ==========================================================================
  // Error & Crash Tracking
  // ==========================================================================

  private setupErrorHandler(): void {
    const originalHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      this.trackCrash(error, isFatal);

      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  trackError(error: Error, context?: Record<string, any>): void {
    this.errorCount++;
    this.lastError = error;

    this.track('error_occurred', {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack?.substring(0, 1000),
      error_count_session: this.errorCount,
      current_screen: this.currentScreen,
      ...context,
    });
  }

  private async trackCrash(error: Error, isFatal?: boolean): Promise<void> {
    const crashData = {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack?.substring(0, 2000),
      is_fatal: isFatal,
      current_screen: this.currentScreen,
      session_id: this.sessionId,
      timestamp: Date.now(),
      device_info: this.getDeviceInfo(),
    };

    // Save crash for next session
    await AsyncStorage.setItem(STORAGE_KEYS.CRASH_LOG, JSON.stringify(crashData));

    // Try to send immediately
    this.track('crash_detected', crashData);
    await this.flush();
  }

  private async checkForPreviousCrash(): Promise<void> {
    try {
      const crashLog = await AsyncStorage.getItem(STORAGE_KEYS.CRASH_LOG);
      if (crashLog) {
        const crashData = JSON.parse(crashLog);
        this.track('crash_detected', {
          ...crashData,
          reported_from_previous_session: true,
        });
        await AsyncStorage.removeItem(STORAGE_KEYS.CRASH_LOG);
      }
    } catch (error) {
      console.error('[Analytics] Failed to check crash log:', error);
    }
  }

  trackApiError(
    endpoint: string,
    method: string,
    statusCode: number,
    errorMessage?: string
  ): void {
    this.track('api_error', {
      endpoint,
      method,
      status_code: statusCode,
      error_message: errorMessage,
    });
  }

  // ==========================================================================
  // Performance Tracking
  // ==========================================================================

  startTiming(eventName: string): void {
    this.timingEvents.set(eventName, Date.now());
  }

  endTiming(eventName: string, properties?: Record<string, any>): number | null {
    const startTime = this.timingEvents.get(eventName);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.track(eventName as AnalyticsEventName, {
        ...properties,
        duration_ms: duration,
      });
      this.timingEvents.delete(eventName);
      return duration;
    }
    return null;
  }

  markPerformance(markName: string): void {
    this.performanceMarks.set(markName, Date.now());
  }

  measurePerformance(
    measureName: string,
    startMark: string,
    endMark?: string
  ): number | null {
    const startTime = this.performanceMarks.get(startMark);
    const endTime = endMark ? this.performanceMarks.get(endMark) : Date.now();

    if (startTime && endTime) {
      const duration = endTime - startTime;
      this.track('screen_load_time', {
        measure_name: measureName,
        duration_ms: duration,
      });
      return duration;
    }
    return null;
  }

  trackScreenLoadTime(screenName: string, loadTimeMs: number): void {
    this.track('screen_load_time', {
      screen_name: screenName,
      load_time_ms: loadTimeMs,
    });
  }

  trackApiResponseTime(endpoint: string, method: string, responseTimeMs: number): void {
    this.track('api_response_time', {
      endpoint,
      method,
      response_time_ms: responseTimeMs,
    });
  }

  // ==========================================================================
  // Revenue Tracking
  // ==========================================================================

  trackPurchase(
    productId: string,
    price: number,
    currency: string,
    transactionId?: string
  ): void {
    this.track('purchase_completed', {
      product_id: productId,
      price,
      currency,
      transaction_id: transactionId,
    });
  }

  trackSubscription(
    action: 'started' | 'cancelled',
    tier: string,
    price?: number,
    currency?: string
  ): void {
    const eventName = action === 'started' ? 'subscription_started' : 'subscription_cancelled';
    this.track(eventName, { tier, price, currency });
  }

  trackPaywallView(source: string): void {
    this.track('paywall_viewed', { source });
  }

  // ==========================================================================
  // Flush & Persistence
  // ==========================================================================

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    // Check network
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      this.log('Offline, events queued');
      await this.persistEvents();
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const payload = {
        events,
        userId: this.userId,
        deviceId: this.deviceId,
        userProperties: this.userProperties,
        sessionId: this.sessionId,
        deviceInfo: this.getDeviceInfo(),
        timestamp: Date.now(),
      };

      // In production, send to analytics endpoint
      if (!this.config.debug) {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Analytics flush failed: ${response.status}`);
        }
      } else {
        this.log('Would send:', events.length, 'events');
      }

      await this.clearPersistedEvents();
      this.log('Flushed', events.length, 'events');
    } catch (error) {
      console.error('[Analytics] Flush failed:', error);
      this.eventQueue = [...events, ...this.eventQueue];
      await this.persistEvents();
    }
  }

  private async loadPersistedEvents(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.QUEUE);
      if (data) {
        const events = JSON.parse(data);
        this.eventQueue = [...events, ...this.eventQueue];
        this.log('Loaded', events.length, 'persisted events');
      }
    } catch (error) {
      console.error('[Analytics] Failed to load persisted events:', error);
    }
  }

  private async persistEvents(): Promise<void> {
    try {
      // Limit persisted events
      const eventsToStore = this.eventQueue.slice(-500);
      await AsyncStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(eventsToStore));
    } catch (error) {
      console.error('[Analytics] Failed to persist events:', error);
    }
  }

  private async clearPersistedEvents(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.QUEUE);
    } catch (error) {
      console.error('[Analytics] Failed to clear persisted events:', error);
    }
  }

  private async clearAllData(): Promise<void> {
    this.eventQueue = [];
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  }

  // ==========================================================================
  // Timer Management
  // ==========================================================================

  private startFlushTimer(): void {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private getDeviceInfo(): Record<string, any> {
    return {
      platform: Platform.OS,
      os_version: Device.osVersion,
      device_model: Device.modelName,
      device_brand: Device.brand,
      is_device: Device.isDevice,
      app_version: Application.nativeApplicationVersion || Constants.expoConfig?.version,
      build_number: Application.nativeBuildVersion,
    };
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[Analytics]', ...args);
    }
  }

  enable(): void {
    this.config.enabled = true;
  }

  disable(): void {
    this.config.enabled = false;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.consentGiven;
  }

  destroy(): void {
    this.stopFlushTimer();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.flush();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const analytics = AnalyticsService.getInstance();

// ============================================================================
// Convenience Functions
// ============================================================================

export const trackEvent = (name: AnalyticsEventName, properties?: Record<string, any>) => {
  analytics.track(name, properties);
};

export const trackScreen = (screenName: string, properties?: Record<string, any>) => {
  analytics.trackScreen(screenName, properties);
};

export const identifyUser = async (userId: string, properties?: Partial<UserProperties>) => {
  await analytics.identify(userId, properties);
};

export const setUserProperties = async (properties: Partial<UserProperties>) => {
  await analytics.setUserProperties(properties);
};

// ============================================================================
// React Hooks
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';

export function useScreenTracking() {
  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    const screenName = route.name;
    trackScreen(screenName, { params: route.params });

    return () => {
      analytics.trackScreenExit(screenName);
    };
  }, [route.name, route.params]);
}

export function useAnalytics() {
  const trackEventCallback = useCallback(
    (name: AnalyticsEventName, properties?: Record<string, any>) => {
      analytics.track(name, properties);
    },
    []
  );

  const trackErrorCallback = useCallback(
    (error: Error, context?: Record<string, any>) => {
      analytics.trackError(error, context);
    },
    []
  );

  return {
    track: trackEventCallback,
    trackError: trackErrorCallback,
    identify: analytics.identify.bind(analytics),
    setUserProperties: analytics.setUserProperties.bind(analytics),
    startTiming: analytics.startTiming.bind(analytics),
    endTiming: analytics.endTiming.bind(analytics),
  };
}

export function usePerformanceTracking(screenName: string) {
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();

    return () => {
      const loadTime = Date.now() - startTimeRef.current;
      analytics.trackScreenLoadTime(screenName, loadTime);
    };
  }, [screenName]);

  const markReady = useCallback(() => {
    const loadTime = Date.now() - startTimeRef.current;
    analytics.trackScreenLoadTime(screenName, loadTime);
  }, [screenName]);

  return { markReady };
}

// ============================================================================
// Pre-built Tracking Helpers
// ============================================================================

export const trackingHelpers = {
  // Auth
  trackSignUp: (method: string) => trackEvent('sign_up', { method }),
  trackLogin: (method: string) => trackEvent('login', { method }),
  trackLogout: () => trackEvent('logout'),

  // Matching
  trackProfileView: (profileId: string) => trackEvent('profile_viewed', { profile_id: profileId }),
  trackLike: (profileId: string) => trackEvent('profile_liked', { profile_id: profileId }),
  trackPass: (profileId: string) => trackEvent('profile_passed', { profile_id: profileId }),
  trackSuperLike: (profileId: string) => trackEvent('profile_super_liked', { profile_id: profileId }),
  trackMatch: (matchId: string, profileId: string) =>
    trackEvent('match_created', { match_id: matchId, profile_id: profileId }),
  trackUnmatch: (matchId: string) => trackEvent('match_unmatched', { match_id: matchId }),

  // Chat
  trackChatOpen: (matchId: string) => trackEvent('chat_opened', { match_id: matchId }),
  trackMessageSent: (matchId: string, type: 'text' | 'image' | 'voice' | 'video' | 'gif') =>
    trackEvent('message_sent', { match_id: matchId, message_type: type }),
  trackFirstMessage: (matchId: string) => trackEvent('first_message', { match_id: matchId }),

  // VR
  trackVRSessionStart: (sessionCode: string) =>
    trackEvent('vr_session_started', { session_code: sessionCode }),
  trackVRSessionEnd: (sessionCode: string, duration: number) =>
    trackEvent('vr_session_ended', { session_code: sessionCode, duration_seconds: duration }),
  trackVRSessionJoin: (sessionCode: string) =>
    trackEvent('vr_session_joined', { session_code: sessionCode }),
  trackBoothEnter: (boothId: string) => trackEvent('vr_booth_entered', { booth_id: boothId }),
  trackBoothExit: (boothId: string, duration: number) =>
    trackEvent('vr_booth_exited', { booth_id: boothId, duration_seconds: duration }),

  // Safety
  trackPanicButton: (location: string) => trackEvent('panic_button_pressed', { location }),
  trackBlock: (userId: string, reason?: string) =>
    trackEvent('user_blocked', { blocked_user_id: userId, reason }),
  trackReport: (userId: string, reason: string) =>
    trackEvent('user_reported', { reported_user_id: userId, reason }),

  // Revenue
  trackPaywallView: (source: string) => analytics.trackPaywallView(source),
  trackPurchaseStart: (itemId: string, price: number) =>
    trackEvent('purchase_started', { item_id: itemId, price }),
  trackPurchaseComplete: (itemId: string, price: number, currency: string, transactionId?: string) =>
    analytics.trackPurchase(itemId, price, currency, transactionId),
  trackPurchaseFail: (itemId: string, error: string) =>
    trackEvent('purchase_failed', { item_id: itemId, error }),
  trackSubscriptionStart: (tier: string, price: number, currency: string) =>
    analytics.trackSubscription('started', tier, price, currency),
  trackSubscriptionCancel: (tier: string) => analytics.trackSubscription('cancelled', tier),

  // Features
  trackBoostActivate: () => trackEvent('boost_activated'),
  trackSpotlightActivate: () => trackEvent('spotlight_activated'),
  trackRewindUse: () => trackEvent('rewind_used'),

  // Errors
  trackError: (error: Error, context?: Record<string, any>) => analytics.trackError(error, context),
  trackApiError: (endpoint: string, method: string, statusCode: number, message?: string) =>
    analytics.trackApiError(endpoint, method, statusCode, message),
};

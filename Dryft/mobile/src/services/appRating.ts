import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { analytics, trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type RatingTrigger =
  | 'match_created'
  | 'first_message_sent'
  | 'conversation_milestone'
  | 'vr_session_completed'
  | 'profile_verified'
  | 'subscription_started'
  | 'positive_interaction'
  | 'app_milestone'
  | 'manual';

export interface RatingState {
  hasRated: boolean;
  hasDeclined: boolean;
  lastPromptAt: number | null;
  promptCount: number;
  lastDeclineAt: number | null;
  declineCount: number;
  positiveEvents: number;
  appOpens: number;
  matchCount: number;
  messageCount: number;
  firstOpenAt: number;
}

export interface RatingConfig {
  minAppOpens: number;
  minDaysSinceInstall: number;
  minPositiveEvents: number;
  minMatches: number;
  cooldownDays: number;
  maxPromptsPerVersion: number;
  declineCooldownDays: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  RATING_STATE: 'dryft_rating_state',
  APP_VERSION_PROMPTED: 'dryft_rating_version_prompted',
};

const DEFAULT_CONFIG: RatingConfig = {
  minAppOpens: 5,
  minDaysSinceInstall: 3,
  minPositiveEvents: 3,
  minMatches: 1,
  cooldownDays: 30,
  maxPromptsPerVersion: 2,
  declineCooldownDays: 90,
};

const DEFAULT_STATE: RatingState = {
  hasRated: false,
  hasDeclined: false,
  lastPromptAt: null,
  promptCount: 0,
  lastDeclineAt: null,
  declineCount: 0,
  positiveEvents: 0,
  appOpens: 0,
  matchCount: 0,
  messageCount: 0,
  firstOpenAt: Date.now(),
};

// Store URLs
const STORE_URLS = {
  ios: `https://apps.apple.com/app/id${Constants.expoConfig?.ios?.bundleIdentifier || 'dryft'}`,
  android: `https://play.google.com/store/apps/details?id=${Constants.expoConfig?.android?.package || 'com.dryft.app'}`,
};

// ============================================================================
// App Rating Service
// ============================================================================

class AppRatingService {
  private static instance: AppRatingService;
  private state: RatingState = DEFAULT_STATE;
  private config: RatingConfig = DEFAULT_CONFIG;
  private initialized = false;
  private pendingPrompt: RatingTrigger | null = null;

  private constructor() {}

  static getInstance(): AppRatingService {
    if (!AppRatingService.instance) {
      AppRatingService.instance = new AppRatingService();
    }
    return AppRatingService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(customConfig?: Partial<RatingConfig>): Promise<void> {
    if (this.initialized) return;

    if (customConfig) {
      this.config = { ...DEFAULT_CONFIG, ...customConfig };
    }

    await this.loadState();
    await this.incrementAppOpen();

    this.initialized = true;
    console.log('[AppRating] Initialized', this.state);
  }

  private async loadState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RATING_STATE);
      if (stored) {
        this.state = { ...DEFAULT_STATE, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[AppRating] Failed to load state:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RATING_STATE, JSON.stringify(this.state));
    } catch (error) {
      console.error('[AppRating] Failed to save state:', error);
    }
  }

  // ==========================================================================
  // Event Tracking
  // ==========================================================================

  private async incrementAppOpen(): Promise<void> {
    this.state.appOpens++;
    await this.saveState();
  }

  async recordMatch(): Promise<boolean> {
    this.state.matchCount++;
    this.state.positiveEvents++;
    await this.saveState();

    return this.checkAndTrigger('match_created');
  }

  async recordMessageSent(isFirst: boolean = false): Promise<boolean> {
    this.state.messageCount++;
    if (isFirst) {
      this.state.positiveEvents++;
    }
    await this.saveState();

    if (isFirst) {
      return this.checkAndTrigger('first_message_sent');
    }

    // Check for conversation milestone (every 10 messages)
    if (this.state.messageCount % 10 === 0) {
      return this.checkAndTrigger('conversation_milestone');
    }

    return false;
  }

  async recordVRSessionCompleted(): Promise<boolean> {
    this.state.positiveEvents += 2; // VR sessions are high-value
    await this.saveState();

    return this.checkAndTrigger('vr_session_completed');
  }

  async recordProfileVerified(): Promise<boolean> {
    this.state.positiveEvents++;
    await this.saveState();

    return this.checkAndTrigger('profile_verified');
  }

  async recordSubscription(): Promise<boolean> {
    this.state.positiveEvents += 2;
    await this.saveState();

    return this.checkAndTrigger('subscription_started');
  }

  async recordPositiveInteraction(): Promise<boolean> {
    this.state.positiveEvents++;
    await this.saveState();

    return this.checkAndTrigger('positive_interaction');
  }

  // ==========================================================================
  // Eligibility Checks
  // ==========================================================================

  private async checkAndTrigger(trigger: RatingTrigger): Promise<boolean> {
    const eligible = await this.isEligibleForPrompt();

    if (eligible) {
      this.pendingPrompt = trigger;
      trackEvent('screen_view', {
        action: 'rating_eligible',
        trigger,
        state: this.getStateSnapshot(),
      });
      return true;
    }

    return false;
  }

  async isEligibleForPrompt(): Promise<boolean> {
    // Already rated
    if (this.state.hasRated) {
      return false;
    }

    // Check minimum app opens
    if (this.state.appOpens < this.config.minAppOpens) {
      return false;
    }

    // Check days since install
    const daysSinceInstall = this.getDaysSinceInstall();
    if (daysSinceInstall < this.config.minDaysSinceInstall) {
      return false;
    }

    // Check positive events
    if (this.state.positiveEvents < this.config.minPositiveEvents) {
      return false;
    }

    // Check matches
    if (this.state.matchCount < this.config.minMatches) {
      return false;
    }

    // Check cooldown since last prompt
    if (this.state.lastPromptAt) {
      const daysSincePrompt = (Date.now() - this.state.lastPromptAt) / (1000 * 60 * 60 * 24);
      if (daysSincePrompt < this.config.cooldownDays) {
        return false;
      }
    }

    // Check decline cooldown
    if (this.state.hasDeclined && this.state.lastDeclineAt) {
      const daysSinceDecline = (Date.now() - this.state.lastDeclineAt) / (1000 * 60 * 60 * 24);
      if (daysSinceDecline < this.config.declineCooldownDays) {
        return false;
      }
    }

    // Check max prompts per version
    const versionPrompted = await AsyncStorage.getItem(STORAGE_KEYS.APP_VERSION_PROMPTED);
    const currentVersion = Constants.expoConfig?.version || '1.0.0';

    if (versionPrompted === currentVersion && this.state.promptCount >= this.config.maxPromptsPerVersion) {
      return false;
    }

    return true;
  }

  hasPendingPrompt(): boolean {
    return this.pendingPrompt !== null;
  }

  getPendingTrigger(): RatingTrigger | null {
    return this.pendingPrompt;
  }

  clearPendingPrompt(): void {
    this.pendingPrompt = null;
  }

  // ==========================================================================
  // Prompt Actions
  // ==========================================================================

  async showNativeReviewPrompt(): Promise<boolean> {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();

      if (!isAvailable) {
        console.log('[AppRating] Native review not available');
        return false;
      }

      await StoreReview.requestReview();

      // Track the prompt
      await this.recordPromptShown();

      trackEvent('screen_view', {
        action: 'native_review_shown',
        trigger: this.pendingPrompt,
      });

      this.pendingPrompt = null;
      return true;
    } catch (error) {
      console.error('[AppRating] Failed to show native review:', error);
      return false;
    }
  }

  async recordPromptShown(): Promise<void> {
    this.state.lastPromptAt = Date.now();
    this.state.promptCount++;

    const currentVersion = Constants.expoConfig?.version || '1.0.0';
    await AsyncStorage.setItem(STORAGE_KEYS.APP_VERSION_PROMPTED, currentVersion);

    await this.saveState();
  }

  async recordUserRated(): Promise<void> {
    this.state.hasRated = true;
    this.pendingPrompt = null;
    await this.saveState();

    trackEvent('screen_view', {
      action: 'user_rated',
      trigger: this.pendingPrompt,
      total_prompts: this.state.promptCount,
    });
  }

  async recordUserDeclined(): Promise<void> {
    this.state.hasDeclined = true;
    this.state.lastDeclineAt = Date.now();
    this.state.declineCount++;
    this.pendingPrompt = null;
    await this.saveState();

    trackEvent('screen_view', {
      action: 'rating_declined',
      decline_count: this.state.declineCount,
    });
  }

  async recordAskLater(): Promise<void> {
    this.state.lastPromptAt = Date.now();
    this.pendingPrompt = null;
    await this.saveState();

    trackEvent('screen_view', {
      action: 'rating_ask_later',
    });
  }

  // ==========================================================================
  // Store Links
  // ==========================================================================

  async openStoreForReview(): Promise<void> {
    const url = Platform.OS === 'ios'
      ? `${STORE_URLS.ios}?action=write-review`
      : STORE_URLS.android;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        await this.recordUserRated();
      }
    } catch (error) {
      console.error('[AppRating] Failed to open store:', error);
    }
  }

  getStoreUrl(): string {
    return Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getDaysSinceInstall(): number {
    return (Date.now() - this.state.firstOpenAt) / (1000 * 60 * 60 * 24);
  }

  private getStateSnapshot(): Record<string, any> {
    return {
      app_opens: this.state.appOpens,
      positive_events: this.state.positiveEvents,
      match_count: this.state.matchCount,
      message_count: this.state.messageCount,
      days_since_install: Math.floor(this.getDaysSinceInstall()),
      prompt_count: this.state.promptCount,
    };
  }

  getState(): RatingState {
    return { ...this.state };
  }

  async resetState(): Promise<void> {
    this.state = { ...DEFAULT_STATE, firstOpenAt: Date.now() };
    await this.saveState();
    await AsyncStorage.removeItem(STORAGE_KEYS.APP_VERSION_PROMPTED);
  }

  // For testing
  async forceEligible(): Promise<void> {
    this.state = {
      ...this.state,
      hasRated: false,
      hasDeclined: false,
      lastPromptAt: null,
      lastDeclineAt: null,
      positiveEvents: 10,
      appOpens: 10,
      matchCount: 5,
      firstOpenAt: Date.now() - (10 * 24 * 60 * 60 * 1000),
    };
    await this.saveState();
  }
}

export const appRatingService = AppRatingService.getInstance();
export default appRatingService;

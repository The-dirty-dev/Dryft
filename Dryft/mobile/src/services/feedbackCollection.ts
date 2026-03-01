import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';
import { analytics, trackEvent } from './analytics';
import NetInfo from '@react-native-community/netinfo';

// ============================================================================
// Types
// ============================================================================

export type FeedbackType =
  | 'rating_feedback'
  | 'bug_report'
  | 'feature_request'
  | 'general_feedback'
  | 'support_request'
  | 'complaint'
  | 'praise';

export type FeedbackSource =
  | 'rating_prompt'
  | 'settings_menu'
  | 'help_center'
  | 'shake_gesture'
  | 'error_screen'
  | 'manual';

export type FeedbackSentiment = 'positive' | 'neutral' | 'negative';

export interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  source: FeedbackSource;
  sentiment?: FeedbackSentiment;
  rating?: number;
  message: string;
  category?: string;
  tags?: string[];
  metadata: FeedbackMetadata;
  createdAt: string;
  syncedAt?: string;
  status: 'pending' | 'synced' | 'failed';
}

export interface FeedbackMetadata {
  appVersion: string;
  buildNumber: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  deviceBrand: string;
  screenName?: string;
  sessionId?: string;
  userId?: string;
  isSubscriber?: boolean;
  daysSinceInstall?: number;
  matchCount?: number;
}

export interface FeedbackSubmission {
  type: FeedbackType;
  source: FeedbackSource;
  sentiment?: FeedbackSentiment;
  rating?: number;
  message: string;
  category?: string;
  tags?: string[];
  screenName?: string;
  attachScreenshot?: boolean;
}

export interface FeedbackStats {
  totalSubmitted: number;
  lastSubmittedAt?: string;
  averageRating?: number;
  feedbackByType: Record<FeedbackType, number>;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  FEEDBACK_QUEUE: 'dryft_feedback_queue',
  FEEDBACK_STATS: 'dryft_feedback_stats',
  FEEDBACK_HISTORY: 'dryft_feedback_history',
};

const MAX_QUEUE_SIZE = 50;
const MAX_HISTORY_SIZE = 100;
const SYNC_BATCH_SIZE = 10;

const FEEDBACK_CATEGORIES = {
  rating_feedback: [
    'app_experience',
    'matching_quality',
    'vr_features',
    'user_interface',
    'performance',
    'other',
  ],
  bug_report: [
    'crash',
    'freeze',
    'ui_glitch',
    'data_loss',
    'connectivity',
    'vr_issues',
    'other',
  ],
  feature_request: [
    'matching',
    'messaging',
    'profile',
    'vr',
    'safety',
    'subscription',
    'other',
  ],
  general_feedback: [
    'suggestion',
    'question',
    'comment',
    'other',
  ],
  support_request: [
    'account_issue',
    'billing',
    'technical',
    'safety',
    'other',
  ],
  complaint: [
    'user_behavior',
    'app_issue',
    'billing',
    'policy',
    'other',
  ],
  praise: [
    'feature',
    'design',
    'experience',
    'support',
    'other',
  ],
};

// ============================================================================
// Feedback Collection Service
// ============================================================================

class FeedbackCollectionService {
  private static instance: FeedbackCollectionService;
  private syncInProgress = false;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private isSubscriber = false;
  private daysSinceInstall = 0;
  private matchCount = 0;

  private constructor() {}

  static getInstance(): FeedbackCollectionService {
    if (!FeedbackCollectionService.instance) {
      FeedbackCollectionService.instance = new FeedbackCollectionService();
    }
    return FeedbackCollectionService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(config: {
    sessionId?: string;
    userId?: string;
    isSubscriber?: boolean;
    daysSinceInstall?: number;
    matchCount?: number;
  }): Promise<void> {
    this.sessionId = config.sessionId || null;
    this.userId = config.userId || null;
    this.isSubscriber = config.isSubscriber || false;
    this.daysSinceInstall = config.daysSinceInstall || 0;
    this.matchCount = config.matchCount || 0;

    // Try to sync any pending feedback
    await this.syncPendingFeedback();
  }

  updateContext(config: Partial<{
    sessionId: string;
    userId: string;
    isSubscriber: boolean;
    daysSinceInstall: number;
    matchCount: number;
  }>): void {
    if (config.sessionId !== undefined) this.sessionId = config.sessionId;
    if (config.userId !== undefined) this.userId = config.userId;
    if (config.isSubscriber !== undefined) this.isSubscriber = config.isSubscriber;
    if (config.daysSinceInstall !== undefined) this.daysSinceInstall = config.daysSinceInstall;
    if (config.matchCount !== undefined) this.matchCount = config.matchCount;
  }

  // ==========================================================================
  // Submit Feedback
  // ==========================================================================

  async submitFeedback(submission: FeedbackSubmission): Promise<FeedbackEntry> {
    const entry = await this.createFeedbackEntry(submission);

    trackEvent('feedback_submitted', {
      type: submission.type,
      source: submission.source,
      sentiment: submission.sentiment,
      rating: submission.rating,
      has_message: !!submission.message,
      category: submission.category,
    });

    // Try to sync immediately
    const synced = await this.trySyncFeedback(entry);

    if (!synced) {
      // Queue for later
      await this.addToQueue(entry);
    }

    // Update stats
    await this.updateStats(entry);

    // Add to history
    await this.addToHistory(entry);

    return entry;
  }

  async submitRatingFeedback(
    rating: number,
    message: string,
    source: FeedbackSource = 'rating_prompt'
  ): Promise<FeedbackEntry> {
    const sentiment: FeedbackSentiment =
      rating >= 4 ? 'positive' : rating >= 3 ? 'neutral' : 'negative';

    return this.submitFeedback({
      type: 'rating_feedback',
      source,
      sentiment,
      rating,
      message,
      category: 'app_experience',
    });
  }

  async submitBugReport(
    message: string,
    category?: string,
    screenName?: string
  ): Promise<FeedbackEntry> {
    return this.submitFeedback({
      type: 'bug_report',
      source: 'manual',
      sentiment: 'negative',
      message,
      category: category || 'other',
      screenName,
    });
  }

  async submitFeatureRequest(
    message: string,
    category?: string
  ): Promise<FeedbackEntry> {
    return this.submitFeedback({
      type: 'feature_request',
      source: 'manual',
      sentiment: 'neutral',
      message,
      category: category || 'other',
    });
  }

  async submitSupportRequest(
    message: string,
    category?: string
  ): Promise<FeedbackEntry> {
    return this.submitFeedback({
      type: 'support_request',
      source: 'help_center',
      sentiment: 'neutral',
      message,
      category: category || 'other',
    });
  }

  // ==========================================================================
  // Feedback Entry Creation
  // ==========================================================================

  private async createFeedbackEntry(
    submission: FeedbackSubmission
  ): Promise<FeedbackEntry> {
    const metadata = await this.collectMetadata(submission.screenName);

    return {
      id: this.generateId(),
      type: submission.type,
      source: submission.source,
      sentiment: submission.sentiment,
      rating: submission.rating,
      message: submission.message,
      category: submission.category,
      tags: submission.tags,
      metadata,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
  }

  private async collectMetadata(screenName?: string): Promise<FeedbackMetadata> {
    return {
      appVersion: Constants.expoConfig?.version || '1.0.0',
      buildNumber: Application.nativeBuildVersion || '1',
      platform: Platform.OS,
      osVersion: Platform.Version.toString(),
      deviceModel: Device.modelName || 'unknown',
      deviceBrand: Device.brand || 'unknown',
      screenName,
      sessionId: this.sessionId || undefined,
      userId: this.userId || undefined,
      isSubscriber: this.isSubscriber,
      daysSinceInstall: this.daysSinceInstall,
      matchCount: this.matchCount,
    };
  }

  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==========================================================================
  // Sync Management
  // ==========================================================================

  private async trySyncFeedback(entry: FeedbackEntry): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return false;
      }

      await api.post('/v1/feedback', {
        id: entry.id,
        type: entry.type,
        source: entry.source,
        sentiment: entry.sentiment,
        rating: entry.rating,
        message: entry.message,
        category: entry.category,
        tags: entry.tags,
        metadata: entry.metadata,
        created_at: entry.createdAt,
      });

      entry.status = 'synced';
      entry.syncedAt = new Date().toISOString();

      return true;
    } catch (error) {
      console.error('[FeedbackCollection] Sync failed:', error);
      entry.status = 'failed';
      return false;
    }
  }

  async syncPendingFeedback(): Promise<number> {
    if (this.syncInProgress) {
      return 0;
    }

    this.syncInProgress = true;
    let syncedCount = 0;

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return 0;
      }

      const queue = await this.getQueue();
      const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'failed');

      // Sync in batches
      for (let i = 0; i < pendingItems.length; i += SYNC_BATCH_SIZE) {
        const batch = pendingItems.slice(i, i + SYNC_BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(item => this.trySyncFeedback(item))
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            syncedCount++;
          }
        });
      }

      // Update queue with sync results
      await this.saveQueue(queue);

      // Remove successfully synced items
      const updatedQueue = queue.filter(item => item.status !== 'synced');
      await this.saveQueue(updatedQueue);

      console.log(`[FeedbackCollection] Synced ${syncedCount} feedback items`);
    } catch (error) {
      console.error('[FeedbackCollection] Batch sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }

    return syncedCount;
  }

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  private async getQueue(): Promise<FeedbackEntry[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FEEDBACK_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  private async saveQueue(queue: FeedbackEntry[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.FEEDBACK_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[FeedbackCollection] Failed to save queue:', error);
    }
  }

  private async addToQueue(entry: FeedbackEntry): Promise<void> {
    const queue = await this.getQueue();

    // Limit queue size
    if (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift(); // Remove oldest
    }

    queue.push(entry);
    await this.saveQueue(queue);
  }

  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter(item => item.status === 'pending' || item.status === 'failed').length;
  }

  // ==========================================================================
  // History Management
  // ==========================================================================

  private async addToHistory(entry: FeedbackEntry): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FEEDBACK_HISTORY);
      const history: FeedbackEntry[] = stored ? JSON.parse(stored) : [];

      history.unshift(entry);

      // Limit history size
      const trimmed = history.slice(0, MAX_HISTORY_SIZE);

      await AsyncStorage.setItem(STORAGE_KEYS.FEEDBACK_HISTORY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[FeedbackCollection] Failed to save to history:', error);
    }
  }

  async getHistory(): Promise<FeedbackEntry[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FEEDBACK_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.FEEDBACK_HISTORY);
  }

  // ==========================================================================
  // Stats Management
  // ==========================================================================

  private async updateStats(entry: FeedbackEntry): Promise<void> {
    try {
      const stats = await this.getStats();

      stats.totalSubmitted++;
      stats.lastSubmittedAt = entry.createdAt;

      // Update by type
      stats.feedbackByType[entry.type] = (stats.feedbackByType[entry.type] || 0) + 1;

      // Update average rating
      if (entry.rating !== undefined) {
        const ratingCount = stats.feedbackByType.rating_feedback || 1;
        const currentAvg = stats.averageRating || 0;
        stats.averageRating = ((currentAvg * (ratingCount - 1)) + entry.rating) / ratingCount;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.FEEDBACK_STATS, JSON.stringify(stats));
    } catch (error) {
      console.error('[FeedbackCollection] Failed to update stats:', error);
    }
  }

  async getStats(): Promise<FeedbackStats> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FEEDBACK_STATS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      // Return default
    }

    return {
      totalSubmitted: 0,
      feedbackByType: {} as Record<FeedbackType, number>,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getCategories(type: FeedbackType): string[] {
    return FEEDBACK_CATEGORIES[type] || ['other'];
  }

  getAllFeedbackTypes(): FeedbackType[] {
    return [
      'rating_feedback',
      'bug_report',
      'feature_request',
      'general_feedback',
      'support_request',
      'complaint',
      'praise',
    ];
  }

  getFeedbackTypeLabel(type: FeedbackType): string {
    const labels: Record<FeedbackType, string> = {
      rating_feedback: 'App Rating',
      bug_report: 'Bug Report',
      feature_request: 'Feature Request',
      general_feedback: 'General Feedback',
      support_request: 'Support Request',
      complaint: 'Complaint',
      praise: 'Praise',
    };
    return labels[type];
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      app_experience: 'App Experience',
      matching_quality: 'Matching Quality',
      vr_features: 'VR Features',
      user_interface: 'User Interface',
      performance: 'Performance',
      crash: 'App Crash',
      freeze: 'App Freeze',
      ui_glitch: 'UI Glitch',
      data_loss: 'Data Loss',
      connectivity: 'Connectivity',
      vr_issues: 'VR Issues',
      matching: 'Matching',
      messaging: 'Messaging',
      profile: 'Profile',
      vr: 'VR Features',
      safety: 'Safety',
      subscription: 'Subscription',
      suggestion: 'Suggestion',
      question: 'Question',
      comment: 'Comment',
      account_issue: 'Account Issue',
      billing: 'Billing',
      technical: 'Technical',
      user_behavior: 'User Behavior',
      app_issue: 'App Issue',
      policy: 'Policy',
      feature: 'Feature',
      design: 'Design',
      experience: 'Experience',
      support: 'Support',
      other: 'Other',
    };
    return labels[category] || category;
  }

  // ==========================================================================
  // Reset
  // ==========================================================================

  async reset(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.FEEDBACK_QUEUE,
      STORAGE_KEYS.FEEDBACK_STATS,
      STORAGE_KEYS.FEEDBACK_HISTORY,
    ]);
  }
}

export const feedbackCollectionService = FeedbackCollectionService.getInstance();
export default feedbackCollectionService;

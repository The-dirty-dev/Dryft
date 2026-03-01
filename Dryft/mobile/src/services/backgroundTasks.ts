import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type BackgroundTaskName =
  | 'DRYFT_SYNC_DATA'
  | 'DRYFT_FETCH_MATCHES'
  | 'DRYFT_CHECK_MESSAGES'
  | 'DRYFT_LOCATION_UPDATE';

export interface BackgroundTaskResult {
  success: boolean;
  newData: boolean;
  error?: string;
}

export interface SyncResult {
  matchesUpdated: number;
  messagesReceived: number;
  likesReceived: number;
  profileUpdated: boolean;
}

export interface BackgroundTaskConfig {
  minimumInterval: number; // seconds
  stopOnTerminate: boolean;
  startOnBoot: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TASK_NAMES: Record<string, BackgroundTaskName> = {
  SYNC_DATA: 'DRYFT_SYNC_DATA',
  FETCH_MATCHES: 'DRYFT_FETCH_MATCHES',
  CHECK_MESSAGES: 'DRYFT_CHECK_MESSAGES',
  LOCATION_UPDATE: 'DRYFT_LOCATION_UPDATE',
};

const STORAGE_KEYS = {
  LAST_SYNC: 'dryft_bg_last_sync',
  SYNC_STATS: 'dryft_bg_sync_stats',
  TASK_CONFIG: 'dryft_bg_task_config',
};

const DEFAULT_CONFIG: BackgroundTaskConfig = {
  minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
  stopOnTerminate: false,
  startOnBoot: true,
};

// ============================================================================
// Task Handlers
// ============================================================================

// These need to be defined at module level for TaskManager
const taskHandlers: Record<string, () => Promise<BackgroundFetch.BackgroundFetchResult>> = {};

// Main sync task
taskHandlers[TASK_NAMES.SYNC_DATA] = async () => {
  console.log('[BackgroundTasks] Running sync task');

  try {
    // Check network
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const result = await backgroundTasksService.performSync();

    if (result.newData) {
      // Show notification for new activity
      await backgroundTasksService.showNewActivityNotification(result);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundTasks] Sync failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
};

// Fetch matches task
taskHandlers[TASK_NAMES.FETCH_MATCHES] = async () => {
  console.log('[BackgroundTasks] Fetching new matches');

  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const hasNewMatches = await backgroundTasksService.checkForNewMatches();

    if (hasNewMatches) {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundTasks] Match fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
};

// Check messages task
taskHandlers[TASK_NAMES.CHECK_MESSAGES] = async () => {
  console.log('[BackgroundTasks] Checking for new messages');

  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const hasNewMessages = await backgroundTasksService.checkForNewMessages();

    if (hasNewMessages) {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundTasks] Message check failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
};

// Register task handlers with TaskManager
Object.entries(taskHandlers).forEach(([taskName, handler]) => {
  TaskManager.defineTask(taskName, async () => {
    return handler();
  });
});

// ============================================================================
// Background Tasks Service
// ============================================================================

class BackgroundTasksService {
  private static instance: BackgroundTasksService;
  private config: BackgroundTaskConfig = DEFAULT_CONFIG;
  private initialized = false;

  private constructor() {}

  static getInstance(): BackgroundTasksService {
    if (!BackgroundTasksService.instance) {
      BackgroundTasksService.instance = new BackgroundTasksService();
    }
    return BackgroundTasksService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(customConfig?: Partial<BackgroundTaskConfig>): Promise<void> {
    if (this.initialized) return;

    if (customConfig) {
      this.config = { ...DEFAULT_CONFIG, ...customConfig };
    }

    // Load saved config
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.TASK_CONFIG);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[BackgroundTasks] Failed to load config:', error);
    }

    // Register background fetch
    await this.registerBackgroundFetch();

    this.initialized = true;
    console.log('[BackgroundTasks] Initialized');
  }

  private async registerBackgroundFetch(): Promise<void> {
    try {
      // Check if background fetch is available
      const status = await BackgroundFetch.getStatusAsync();

      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        console.warn('[BackgroundTasks] Background fetch restricted');
        return;
      }

      if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.warn('[BackgroundTasks] Background fetch denied');
        return;
      }

      // Register the main sync task
      await BackgroundFetch.registerTaskAsync(TASK_NAMES.SYNC_DATA, {
        minimumInterval: this.config.minimumInterval,
        stopOnTerminate: this.config.stopOnTerminate,
        startOnBoot: this.config.startOnBoot,
      });

      console.log('[BackgroundTasks] Registered sync task');
    } catch (error) {
      console.error('[BackgroundTasks] Failed to register:', error);
    }
  }

  async unregisterAll(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(TASK_NAMES.SYNC_DATA);
      console.log('[BackgroundTasks] Unregistered all tasks');
    } catch (error) {
      console.error('[BackgroundTasks] Failed to unregister:', error);
    }
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  async performSync(): Promise<{ newData: boolean } & SyncResult> {
    const startTime = Date.now();

    const result: SyncResult = {
      matchesUpdated: 0,
      messagesReceived: 0,
      likesReceived: 0,
      profileUpdated: false,
    };

    try {
      // These would call your actual API
      const [matchResult, messageResult, likeResult] = await Promise.all([
        this.syncMatches(),
        this.syncMessages(),
        this.syncLikes(),
      ]);

      result.matchesUpdated = matchResult;
      result.messagesReceived = messageResult;
      result.likesReceived = likeResult;

      // Save sync timestamp
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());

      // Update sync stats
      await this.updateSyncStats(result, Date.now() - startTime);

      trackEvent('background_sync_completed', {
        duration_ms: Date.now() - startTime,
        matches: result.matchesUpdated,
        messages: result.messagesReceived,
        likes: result.likesReceived,
      });

      const hasNewData =
        result.matchesUpdated > 0 ||
        result.messagesReceived > 0 ||
        result.likesReceived > 0;

      return { newData: hasNewData, ...result };
    } catch (error) {
      console.error('[BackgroundTasks] Sync error:', error);
      return { newData: false, ...result };
    }
  }

  private async syncMatches(): Promise<number> {
    // This would call your matches API and return count of new matches
    // For now, returning 0 as a placeholder
    try {
      // const response = await api.get('/v1/matches/updates');
      // return response.data.newMatches?.length || 0;
      return 0;
    } catch (error) {
      console.error('[BackgroundTasks] Match sync error:', error);
      return 0;
    }
  }

  private async syncMessages(): Promise<number> {
    // This would check for new messages
    try {
      // const response = await api.get('/v1/messages/unread');
      // return response.data.count || 0;
      return 0;
    } catch (error) {
      console.error('[BackgroundTasks] Message sync error:', error);
      return 0;
    }
  }

  private async syncLikes(): Promise<number> {
    // This would check for new likes
    try {
      // const response = await api.get('/v1/likes/new');
      // return response.data.count || 0;
      return 0;
    } catch (error) {
      console.error('[BackgroundTasks] Like sync error:', error);
      return 0;
    }
  }

  async checkForNewMatches(): Promise<boolean> {
    const result = await this.syncMatches();
    return result > 0;
  }

  async checkForNewMessages(): Promise<boolean> {
    const result = await this.syncMessages();
    return result > 0;
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  async showNewActivityNotification(result: SyncResult): Promise<void> {
    // Build notification content based on what's new
    let title = '';
    let body = '';

    if (result.matchesUpdated > 0 && result.messagesReceived > 0) {
      title = 'New Activity';
      body = `You have ${result.matchesUpdated} new match${result.matchesUpdated > 1 ? 'es' : ''} and ${result.messagesReceived} new message${result.messagesReceived > 1 ? 's' : ''}`;
    } else if (result.matchesUpdated > 0) {
      title = 'New Match!';
      body = result.matchesUpdated > 1
        ? `You have ${result.matchesUpdated} new matches`
        : 'Someone matched with you!';
    } else if (result.messagesReceived > 0) {
      title = 'New Messages';
      body = `You have ${result.messagesReceived} unread message${result.messagesReceived > 1 ? 's' : ''}`;
    } else if (result.likesReceived > 0) {
      title = 'New Likes';
      body = `${result.likesReceived} people liked you`;
    }

    if (title && body) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          badge: result.matchesUpdated + result.messagesReceived + result.likesReceived,
          data: {
            type: 'background_sync',
            ...result,
          },
        },
        trigger: null, // Send immediately
      });
    }
  }

  // ==========================================================================
  // Stats
  // ==========================================================================

  private async updateSyncStats(
    result: SyncResult,
    durationMs: number
  ): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATS);
      const stats = stored ? JSON.parse(stored) : {
        totalSyncs: 0,
        totalDurationMs: 0,
        totalMatches: 0,
        totalMessages: 0,
        totalLikes: 0,
        lastSyncAt: null,
      };

      stats.totalSyncs++;
      stats.totalDurationMs += durationMs;
      stats.totalMatches += result.matchesUpdated;
      stats.totalMessages += result.messagesReceived;
      stats.totalLikes += result.likesReceived;
      stats.lastSyncAt = Date.now();

      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATS, JSON.stringify(stats));
    } catch (error) {
      console.error('[BackgroundTasks] Failed to update stats:', error);
    }
  }

  async getSyncStats(): Promise<{
    totalSyncs: number;
    averageDurationMs: number;
    lastSyncAt: number | null;
  }> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATS);
      if (stored) {
        const stats = JSON.parse(stored);
        return {
          totalSyncs: stats.totalSyncs,
          averageDurationMs: stats.totalSyncs > 0
            ? Math.round(stats.totalDurationMs / stats.totalSyncs)
            : 0,
          lastSyncAt: stats.lastSyncAt,
        };
      }
    } catch (error) {
      console.error('[BackgroundTasks] Failed to get stats:', error);
    }

    return {
      totalSyncs: 0,
      averageDurationMs: 0,
      lastSyncAt: null,
    };
  }

  async getLastSyncTime(): Promise<Date | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return stored ? new Date(parseInt(stored, 10)) : null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  async updateConfig(newConfig: Partial<BackgroundTaskConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await AsyncStorage.setItem(STORAGE_KEYS.TASK_CONFIG, JSON.stringify(this.config));

    // Re-register with new config
    await this.unregisterAll();
    await this.registerBackgroundFetch();
  }

  getConfig(): BackgroundTaskConfig {
    return { ...this.config };
  }

  // ==========================================================================
  // Status
  // ==========================================================================

  async getStatus(): Promise<{
    isAvailable: boolean;
    status: BackgroundFetch.BackgroundFetchStatus;
    isRegistered: boolean;
  }> {
    const status = await BackgroundFetch.getStatusAsync();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAMES.SYNC_DATA);

    return {
      isAvailable: status === BackgroundFetch.BackgroundFetchStatus.Available,
      status,
      isRegistered,
    };
  }

  // ==========================================================================
  // Manual Trigger (for testing)
  // ==========================================================================

  async triggerSync(): Promise<SyncResult> {
    const result = await this.performSync();
    return {
      matchesUpdated: result.matchesUpdated,
      messagesReceived: result.messagesReceived,
      likesReceived: result.likesReceived,
      profileUpdated: result.profileUpdated,
    };
  }
}

export const backgroundTasksService = BackgroundTasksService.getInstance();
export default backgroundTasksService;

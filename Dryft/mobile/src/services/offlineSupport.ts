import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { analytics, trackEvent } from './analytics';

/**
 * Offline support utilities for network state, caching, and sync queues.
 * Centralizes connection quality tracking and deferred actions.
 * @example
 * const state = await getNetworkState();
 */
// ============================================================================
// Types
// ============================================================================

export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: ConnectionType;
  connectionQuality: ConnectionQuality;
  effectiveType?: string; // 2g, 3g, 4g, 5g
  downlink?: number; // Mbps
  rtt?: number; // Round-trip time in ms
}

export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'normal' | 'low';
}

export interface OfflineConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number; // ms
  syncBatchSize: number;
}

type NetworkStatusListener = (status: NetworkStatus) => void;
type ConnectionChangeListener = (isConnected: boolean) => void;

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  ACTION_QUEUE: 'dryft_offline_action_queue',
  LAST_SYNC: 'dryft_offline_last_sync',
  NETWORK_HISTORY: 'dryft_network_history',
};

const DEFAULT_CONFIG: OfflineConfig = {
  maxQueueSize: 100,
  maxRetries: 3,
  retryDelay: 5000,
  syncBatchSize: 10,
};

// ============================================================================
// Offline Support Service
// ============================================================================

class OfflineSupportService {
  private static instance: OfflineSupportService;
  private config: OfflineConfig = DEFAULT_CONFIG;
  private currentStatus: NetworkStatus = {
    isConnected: true,
    isInternetReachable: null,
    connectionType: 'unknown',
    connectionQuality: 'good',
  };
  private actionQueue: QueuedAction[] = [];
  private statusListeners: Set<NetworkStatusListener> = new Set();
  private connectionListeners: Set<ConnectionChangeListener> = new Set();
  private netInfoSubscription: NetInfoSubscription | null = null;
  private appStateSubscription: any = null;
  private isSyncing = false;
  private syncTimeout: NodeJS.Timeout | null = null;
  private offlineStartTime: number | null = null;

  private constructor() {}

  static getInstance(): OfflineSupportService {
    if (!OfflineSupportService.instance) {
      OfflineSupportService.instance = new OfflineSupportService();
    }
    return OfflineSupportService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(customConfig?: Partial<OfflineConfig>): Promise<void> {
    if (customConfig) {
      this.config = { ...DEFAULT_CONFIG, ...customConfig };
    }

    // Load queued actions
    await this.loadQueue();

    // Get initial network state
    const netInfo = await NetInfo.fetch();
    this.updateNetworkStatus(netInfo);

    // Subscribe to network changes
    this.netInfoSubscription = NetInfo.addEventListener(this.handleNetworkChange);

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );

    console.log('[OfflineSupport] Initialized', this.currentStatus);
  }

  cleanup(): void {
    if (this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    this.statusListeners.clear();
    this.connectionListeners.clear();
  }

  // ==========================================================================
  // Network Status
  // ==========================================================================

  private handleNetworkChange = (state: NetInfoState): void => {
    const wasConnected = this.currentStatus.isConnected;
    this.updateNetworkStatus(state);

    // Track connection changes
    if (wasConnected !== this.currentStatus.isConnected) {
      if (this.currentStatus.isConnected) {
        // Came online
        const offlineDuration = this.offlineStartTime
          ? Math.floor((Date.now() - this.offlineStartTime) / 1000)
          : 0;

        trackEvent('network_restored', {
          offline_duration_seconds: offlineDuration,
          connection_type: this.currentStatus.connectionType,
          queued_actions: this.actionQueue.length,
        });

        this.offlineStartTime = null;

        // Start syncing queued actions
        this.schedulSync();
      } else {
        // Went offline
        this.offlineStartTime = Date.now();

        trackEvent('network_lost', {
          previous_connection: wasConnected ? 'connected' : 'unknown',
        });
      }

      // Notify listeners
      this.connectionListeners.forEach((listener) => {
        try {
          listener(this.currentStatus.isConnected);
        } catch (error) {
          console.error('[OfflineSupport] Connection listener error:', error);
        }
      });
    }

    // Notify status listeners
    this.statusListeners.forEach((listener) => {
      try {
        listener(this.currentStatus);
      } catch (error) {
        console.error('[OfflineSupport] Status listener error:', error);
      }
    });
  };

  private updateNetworkStatus(state: NetInfoState): void {
    const connectionType = this.mapConnectionType(state.type);
    const quality = this.assessConnectionQuality(state);

    this.currentStatus = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      connectionType,
      connectionQuality: quality,
      effectiveType: (state.details as any)?.cellularGeneration,
    };
  }

  private mapConnectionType(type: string): ConnectionType {
    switch (type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'none':
        return 'none';
      default:
        return 'unknown';
    }
  }

  private assessConnectionQuality(state: NetInfoState): ConnectionQuality {
    if (!state.isConnected) {
      return 'offline';
    }

    const details = state.details as any;

    // Check cellular generation
    if (state.type === 'cellular' && details?.cellularGeneration) {
      switch (details.cellularGeneration) {
        case '5g':
          return 'excellent';
        case '4g':
          return 'good';
        case '3g':
          return 'fair';
        case '2g':
          return 'poor';
      }
    }

    // WiFi is generally good
    if (state.type === 'wifi') {
      return 'good';
    }

    return 'fair';
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    if (nextState === 'active') {
      // App came to foreground - check connection and sync
      NetInfo.fetch().then((state) => {
        this.updateNetworkStatus(state);
        if (this.currentStatus.isConnected) {
          this.schedulSync();
        }
      });
    }
  };

  // ==========================================================================
  // Status Getters
  // ==========================================================================

  getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  isOnline(): boolean {
    return this.currentStatus.isConnected && this.currentStatus.isInternetReachable !== false;
  }

  isOffline(): boolean {
    return !this.isOnline();
  }

  getConnectionQuality(): ConnectionQuality {
    return this.currentStatus.connectionQuality;
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  addStatusListener(listener: NetworkStatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately call with current status
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  addConnectionListener(listener: ConnectionChangeListener): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  // ==========================================================================
  // Action Queue
  // ==========================================================================

  async queueAction(
    type: string,
    payload: any,
    options: { priority?: QueuedAction['priority']; maxRetries?: number } = {}
  ): Promise<string> {
    const action: QueuedAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      priority: options.priority ?? 'normal',
    };

    // Trim queue if too large
    if (this.actionQueue.length >= this.config.maxQueueSize) {
      // Remove oldest low-priority items first
      const lowPriorityIndex = this.actionQueue.findIndex((a) => a.priority === 'low');
      if (lowPriorityIndex >= 0) {
        this.actionQueue.splice(lowPriorityIndex, 1);
      } else {
        this.actionQueue.shift();
      }
    }

    // Insert by priority
    const insertIndex = this.actionQueue.findIndex(
      (a) => this.getPriorityWeight(a.priority) < this.getPriorityWeight(action.priority)
    );

    if (insertIndex >= 0) {
      this.actionQueue.splice(insertIndex, 0, action);
    } else {
      this.actionQueue.push(action);
    }

    await this.saveQueue();

    console.log(`[OfflineSupport] Queued action: ${type}`, action.id);

    return action.id;
  }

  private getPriorityWeight(priority: QueuedAction['priority']): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
        return 1;
    }
  }

  async removeAction(actionId: string): Promise<void> {
    this.actionQueue = this.actionQueue.filter((a) => a.id !== actionId);
    await this.saveQueue();
  }

  getQueuedActions(): QueuedAction[] {
    return [...this.actionQueue];
  }

  getQueueLength(): number {
    return this.actionQueue.length;
  }

  hasQueuedActions(): boolean {
    return this.actionQueue.length > 0;
  }

  // ==========================================================================
  // Queue Persistence
  // ==========================================================================

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ACTION_QUEUE);
      if (stored) {
        this.actionQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[OfflineSupport] Failed to load queue:', error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACTION_QUEUE,
        JSON.stringify(this.actionQueue)
      );
    } catch (error) {
      console.error('[OfflineSupport] Failed to save queue:', error);
    }
  }

  // ==========================================================================
  // Sync Management
  // ==========================================================================

  private schedulSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    // Delay sync slightly to batch multiple rapid changes
    this.syncTimeout = setTimeout(() => {
      this.syncQueue();
    }, 1000);
  }

  async syncQueue(actionHandler?: (action: QueuedAction) => Promise<boolean>): Promise<number> {
    if (this.isSyncing || !this.isOnline() || this.actionQueue.length === 0) {
      return 0;
    }

    this.isSyncing = true;
    let syncedCount = 0;

    try {
      // Process in batches
      const toProcess = this.actionQueue.slice(0, this.config.syncBatchSize);

      for (const action of toProcess) {
        try {
          let success = false;

          if (actionHandler) {
            success = await actionHandler(action);
          } else {
            // Default: just mark as processed
            success = true;
          }

          if (success) {
            await this.removeAction(action.id);
            syncedCount++;
          } else {
            // Increment retry count
            action.retryCount++;
            if (action.retryCount >= action.maxRetries) {
              // Remove failed action
              await this.removeAction(action.id);
              trackEvent('offline_action_failed', {
                type: action.type,
                retries: action.retryCount,
              });
            } else {
              await this.saveQueue();
            }
          }
        } catch (error) {
          console.error(`[OfflineSupport] Sync failed for ${action.id}:`, error);
          action.retryCount++;
          if (action.retryCount >= action.maxRetries) {
            await this.removeAction(action.id);
          }
        }
      }

      if (syncedCount > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
        trackEvent('offline_queue_synced', {
          synced_count: syncedCount,
          remaining: this.actionQueue.length,
        });
      }

      // Continue syncing if more items
      if (this.actionQueue.length > 0 && syncedCount > 0) {
        this.schedulSync();
      }
    } finally {
      this.isSyncing = false;
    }

    return syncedCount;
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
  // Clear / Reset
  // ==========================================================================

  async clearQueue(): Promise<void> {
    this.actionQueue = [];
    await this.saveQueue();
  }

  async reset(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACTION_QUEUE,
      STORAGE_KEYS.LAST_SYNC,
      STORAGE_KEYS.NETWORK_HISTORY,
    ]);
    this.actionQueue = [];
  }
}

export const offlineSupportService = OfflineSupportService.getInstance();
export default offlineSupportService;

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { analytics, trackEvent } from './analytics';
import { biometricAuth } from './biometricAuth';
import { notificationService } from './notifications';

// ============================================================================
// Types
// ============================================================================

export type DeletionReason =
  | 'found_someone'
  | 'taking_break'
  | 'not_useful'
  | 'privacy_concerns'
  | 'too_expensive'
  | 'technical_issues'
  | 'safety_concerns'
  | 'other';

export interface DeletionRequest {
  id: string;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'cancelled';
  reason: DeletionReason;
  feedback?: string;
  requestedAt: string;
  scheduledFor: string;
  gracePeriodEnds: string;
  canCancel: boolean;
}

export interface AccountStatus {
  isActive: boolean;
  deletionScheduled: boolean;
  deletionRequest?: DeletionRequest;
  pauseStatus?: {
    isPaused: boolean;
    pausedAt?: string;
    resumesAt?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const GRACE_PERIOD_DAYS = 30;
const STORAGE_KEYS = {
  DELETION_REQUEST: 'dryft_deletion_request',
  PAUSE_STATUS: 'dryft_pause_status',
};

const DELETION_REASONS: Record<DeletionReason, { label: string; description: string }> = {
  found_someone: {
    label: 'I found someone',
    description: "Congratulations! We're happy for you.",
  },
  taking_break: {
    label: "I'm taking a break",
    description: 'Consider pausing your account instead.',
  },
  not_useful: {
    label: "It's not useful for me",
    description: "We're sorry to hear that.",
  },
  privacy_concerns: {
    label: 'Privacy concerns',
    description: 'Your data privacy is important to us.',
  },
  too_expensive: {
    label: "It's too expensive",
    description: 'You can continue with our free tier.',
  },
  technical_issues: {
    label: 'Technical issues',
    description: 'Please let us know what went wrong.',
  },
  safety_concerns: {
    label: 'Safety concerns',
    description: 'Your safety is our priority.',
  },
  other: {
    label: 'Other reason',
    description: 'Please share your feedback.',
  },
};

// ============================================================================
// Account Deletion Service
// ============================================================================

class AccountDeletionService {
  private static instance: AccountDeletionService;

  private constructor() {}

  static getInstance(): AccountDeletionService {
    if (!AccountDeletionService.instance) {
      AccountDeletionService.instance = new AccountDeletionService();
    }
    return AccountDeletionService.instance;
  }

  // ==========================================================================
  // Deletion Request
  // ==========================================================================

  async requestDeletion(
    reason: DeletionReason,
    feedback?: string
  ): Promise<DeletionRequest> {
    trackEvent('account_deleted', {
      action: 'deletion_requested',
      reason,
      has_feedback: !!feedback,
    });

    try {
      const response = await api.post<DeletionRequest>('/v1/account/delete', {
        reason,
        feedback,
      });

      // Store locally
      await AsyncStorage.setItem(
        STORAGE_KEYS.DELETION_REQUEST,
        JSON.stringify(response.data)
      );

      return response.data;
    } catch (error: any) {
      analytics.trackError(error, { action: 'request_deletion' });
      throw error;
    }
  }

  async cancelDeletion(requestId: string): Promise<void> {
    trackEvent('account_deleted', {
      action: 'deletion_cancelled',
    });

    try {
      await api.post(`/v1/account/delete/${requestId}/cancel`);
      await AsyncStorage.removeItem(STORAGE_KEYS.DELETION_REQUEST);
    } catch (error: any) {
      analytics.trackError(error, { action: 'cancel_deletion' });
      throw error;
    }
  }

  async getDeletionStatus(): Promise<DeletionRequest | null> {
    try {
      // Check local storage first
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DELETION_REQUEST);
      if (stored) {
        const request: DeletionRequest = JSON.parse(stored);

        // Refresh from server
        try {
          const response = await api.get<DeletionRequest>(
            `/v1/account/delete/${request.id}`
          );
          await AsyncStorage.setItem(
            STORAGE_KEYS.DELETION_REQUEST,
            JSON.stringify(response.data)
          );
          return response.data;
        } catch {
          return request;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async getAccountStatus(): Promise<AccountStatus> {
    try {
      const [deletionRequest, pauseStatusStr] = await Promise.all([
        this.getDeletionStatus(),
        AsyncStorage.getItem(STORAGE_KEYS.PAUSE_STATUS),
      ]);

      const pauseStatus = pauseStatusStr ? JSON.parse(pauseStatusStr) : null;

      return {
        isActive: !deletionRequest && !pauseStatus?.isPaused,
        deletionScheduled: !!deletionRequest && deletionRequest.status === 'scheduled',
        deletionRequest: deletionRequest || undefined,
        pauseStatus: pauseStatus || undefined,
      };
    } catch (error) {
      return {
        isActive: true,
        deletionScheduled: false,
      };
    }
  }

  // ==========================================================================
  // Account Pause (Alternative to Deletion)
  // ==========================================================================

  async pauseAccount(durationDays?: number): Promise<void> {
    trackEvent('settings_changed', {
      action: 'account_paused',
      duration_days: durationDays,
    });

    try {
      await api.post('/v1/account/pause', {
        duration_days: durationDays,
      });

      const pauseStatus = {
        isPaused: true,
        pausedAt: new Date().toISOString(),
        resumesAt: durationDays
          ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.PAUSE_STATUS, JSON.stringify(pauseStatus));
    } catch (error: any) {
      analytics.trackError(error, { action: 'pause_account' });
      throw error;
    }
  }

  async resumeAccount(): Promise<void> {
    trackEvent('settings_changed', {
      action: 'account_resumed',
    });

    try {
      await api.post('/v1/account/resume');
      await AsyncStorage.removeItem(STORAGE_KEYS.PAUSE_STATUS);
    } catch (error: any) {
      analytics.trackError(error, { action: 'resume_account' });
      throw error;
    }
  }

  // ==========================================================================
  // Immediate Deletion (No Grace Period)
  // ==========================================================================

  async requestImmediateDeletion(
    reason: DeletionReason,
    feedback?: string,
    password?: string
  ): Promise<void> {
    trackEvent('account_deleted', {
      action: 'immediate_deletion_requested',
      reason,
    });

    try {
      await api.post('/v1/account/delete/immediate', {
        reason,
        feedback,
        password,
        confirm: true,
      });

      // Clear all local data
      await this.clearAllLocalData();
    } catch (error: any) {
      analytics.trackError(error, { action: 'immediate_deletion' });
      throw error;
    }
  }

  // ==========================================================================
  // Data Cleanup
  // ==========================================================================

  async clearAllLocalData(): Promise<void> {
    try {
      // Get all keys
      const allKeys = await AsyncStorage.getAllKeys();

      // Filter Dryft-related keys
      const driftKeys = allKeys.filter(
        key => key.startsWith('dryft_') || key.startsWith('@dryft')
      );

      // Clear AsyncStorage
      await AsyncStorage.multiRemove(driftKeys);

      // Clear SecureStore
      const secureStoreKeys = [
        'dryft_app_lock_enabled',
        'dryft_biometric_enabled',
        'dryft_pin_hash',
        'dryft_lock_timeout',
        'dryft_last_active',
        'dryft_failed_attempts',
        'dryft_lockout_until',
        'dryft_auth_token',
        'dryft_refresh_token',
      ];

      for (const key of secureStoreKeys) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          // Key might not exist
        }
      }

      // Reset services
      await biometricAuth.resetAll();
      await notificationService.unregister();
      await analytics.reset();

      console.log('[AccountDeletion] All local data cleared');
    } catch (error) {
      console.error('[AccountDeletion] Failed to clear data:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getDeletionReasons(): Array<{
    value: DeletionReason;
    label: string;
    description: string;
  }> {
    return Object.entries(DELETION_REASONS).map(([value, { label, description }]) => ({
      value: value as DeletionReason,
      label,
      description,
    }));
  }

  getGracePeriodDays(): number {
    return GRACE_PERIOD_DAYS;
  }

  calculateDeletionDate(requestDate: Date = new Date()): Date {
    return new Date(requestDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  }

  getDaysRemaining(gracePeriodEnds: string): number {
    const endDate = new Date(gracePeriodEnds);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  formatDeletionDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

export const accountDeletionService = AccountDeletionService.getInstance();
export default accountDeletionService;

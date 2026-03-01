import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { analytics, trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type ReportReason =
  | 'fake_profile'
  | 'inappropriate_photos'
  | 'harassment'
  | 'spam'
  | 'scam'
  | 'underage'
  | 'offensive_content'
  | 'threats'
  | 'impersonation'
  | 'other';

export type ReportCategory = 'profile' | 'message' | 'photo' | 'behavior';

export type BlockReason =
  | 'not_interested'
  | 'inappropriate'
  | 'harassment'
  | 'spam'
  | 'other';

export interface ReportData {
  id: string;
  reportedUserId: string;
  reporterId: string;
  reason: ReportReason;
  category: ReportCategory;
  description?: string;
  evidence?: ReportEvidence[];
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
}

export interface ReportEvidence {
  type: 'screenshot' | 'message' | 'photo';
  url?: string;
  messageId?: string;
  description?: string;
}

export interface BlockedUser {
  userId: string;
  userName: string;
  userPhoto?: string;
  reason?: BlockReason;
  blockedAt: string;
}

export interface ModerationAction {
  type: 'block' | 'unblock' | 'report' | 'mute' | 'unmute';
  targetUserId: string;
  timestamp: number;
}

export interface UserSafetyStatus {
  isBlocked: boolean;
  isMuted: boolean;
  hasReported: boolean;
  reportCount?: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  BLOCKED_USERS: 'dryft_blocked_users',
  MUTED_USERS: 'dryft_muted_users',
  REPORTED_USERS: 'dryft_reported_users',
  MODERATION_HISTORY: 'dryft_moderation_history',
};

export const REPORT_REASONS: Record<ReportReason, { label: string; description: string; category: ReportCategory }> = {
  fake_profile: {
    label: 'Fake Profile',
    description: 'This profile appears to be fake or using stolen photos',
    category: 'profile',
  },
  inappropriate_photos: {
    label: 'Inappropriate Photos',
    description: 'Profile contains inappropriate or explicit photos',
    category: 'photo',
  },
  harassment: {
    label: 'Harassment',
    description: 'This user is harassing or bullying me',
    category: 'behavior',
  },
  spam: {
    label: 'Spam',
    description: 'This user is sending spam or promotional content',
    category: 'message',
  },
  scam: {
    label: 'Scam / Fraud',
    description: 'This user is attempting to scam or defraud me',
    category: 'behavior',
  },
  underage: {
    label: 'Underage User',
    description: 'This user appears to be under 18 years old',
    category: 'profile',
  },
  offensive_content: {
    label: 'Offensive Content',
    description: 'Profile or messages contain offensive content',
    category: 'message',
  },
  threats: {
    label: 'Threats / Violence',
    description: 'This user is making threats or promoting violence',
    category: 'behavior',
  },
  impersonation: {
    label: 'Impersonation',
    description: 'This user is impersonating someone else',
    category: 'profile',
  },
  other: {
    label: 'Other',
    description: 'Other reason not listed above',
    category: 'behavior',
  },
};

export const BLOCK_REASONS: Record<BlockReason, string> = {
  not_interested: "I'm not interested",
  inappropriate: 'Inappropriate behavior',
  harassment: 'Harassment',
  spam: 'Spam or scam',
  other: 'Other reason',
};

// ============================================================================
// Moderation Service
// ============================================================================

class ModerationService {
  private static instance: ModerationService;
  private blockedUsers: Map<string, BlockedUser> = new Map();
  private mutedUsers: Set<string> = new Set();
  private reportedUsers: Set<string> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): ModerationService {
    if (!ModerationService.instance) {
      ModerationService.instance = new ModerationService();
    }
    return ModerationService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadBlockedUsers(),
      this.loadMutedUsers(),
      this.loadReportedUsers(),
    ]);

    this.initialized = true;
    console.log('[Moderation] Initialized');
  }

  private async loadBlockedUsers(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BLOCKED_USERS);
      if (stored) {
        const users: BlockedUser[] = JSON.parse(stored);
        users.forEach((user) => this.blockedUsers.set(user.userId, user));
      }
    } catch (error) {
      console.error('[Moderation] Failed to load blocked users:', error);
    }
  }

  private async loadMutedUsers(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MUTED_USERS);
      if (stored) {
        const users: string[] = JSON.parse(stored);
        users.forEach((id) => this.mutedUsers.add(id));
      }
    } catch (error) {
      console.error('[Moderation] Failed to load muted users:', error);
    }
  }

  private async loadReportedUsers(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.REPORTED_USERS);
      if (stored) {
        const users: string[] = JSON.parse(stored);
        users.forEach((id) => this.reportedUsers.add(id));
      }
    } catch (error) {
      console.error('[Moderation] Failed to load reported users:', error);
    }
  }

  private async saveBlockedUsers(): Promise<void> {
    const users = Array.from(this.blockedUsers.values());
    await AsyncStorage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(users));
  }

  private async saveMutedUsers(): Promise<void> {
    const users = Array.from(this.mutedUsers);
    await AsyncStorage.setItem(STORAGE_KEYS.MUTED_USERS, JSON.stringify(users));
  }

  private async saveReportedUsers(): Promise<void> {
    const users = Array.from(this.reportedUsers);
    await AsyncStorage.setItem(STORAGE_KEYS.REPORTED_USERS, JSON.stringify(users));
  }

  // ==========================================================================
  // Block User
  // ==========================================================================

  async blockUser(
    userId: string,
    userName: string,
    userPhoto?: string,
    reason?: BlockReason
  ): Promise<boolean> {
    try {
      // Call API
      await api.post('/v1/users/block', {
        user_id: userId,
        reason,
      });

      // Store locally
      const blockedUser: BlockedUser = {
        userId,
        userName,
        userPhoto,
        reason,
        blockedAt: new Date().toISOString(),
      };

      this.blockedUsers.set(userId, blockedUser);
      await this.saveBlockedUsers();

      // Log action
      await this.logModerationAction({
        type: 'block',
        targetUserId: userId,
        timestamp: Date.now(),
      });

      trackEvent('user_blocked', {
        blocked_user_id: userId,
        reason: reason || 'none',
      });

      return true;
    } catch (error) {
      console.error('[Moderation] Block failed:', error);
      analytics.trackError(error as Error, { action: 'block_user' });
      return false;
    }
  }

  async unblockUser(userId: string): Promise<boolean> {
    try {
      // Call API
      await api.post('/v1/users/unblock', {
        user_id: userId,
      });

      // Remove locally
      this.blockedUsers.delete(userId);
      await this.saveBlockedUsers();

      // Log action
      await this.logModerationAction({
        type: 'unblock',
        targetUserId: userId,
        timestamp: Date.now(),
      });

      trackEvent('user_unblocked', {
        unblocked_user_id: userId,
      });

      return true;
    } catch (error) {
      console.error('[Moderation] Unblock failed:', error);
      return false;
    }
  }

  isUserBlocked(userId: string): boolean {
    return this.blockedUsers.has(userId);
  }

  getBlockedUsers(): BlockedUser[] {
    return Array.from(this.blockedUsers.values()).sort(
      (a, b) => new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime()
    );
  }

  getBlockedUserIds(): string[] {
    return Array.from(this.blockedUsers.keys());
  }

  // ==========================================================================
  // Mute User
  // ==========================================================================

  async muteUser(userId: string): Promise<boolean> {
    try {
      await api.post('/v1/users/mute', { user_id: userId });

      this.mutedUsers.add(userId);
      await this.saveMutedUsers();

      await this.logModerationAction({
        type: 'mute',
        targetUserId: userId,
        timestamp: Date.now(),
      });

      trackEvent('user_muted', { muted_user_id: userId });

      return true;
    } catch (error) {
      console.error('[Moderation] Mute failed:', error);
      return false;
    }
  }

  async unmuteUser(userId: string): Promise<boolean> {
    try {
      await api.post('/v1/users/unmute', { user_id: userId });

      this.mutedUsers.delete(userId);
      await this.saveMutedUsers();

      await this.logModerationAction({
        type: 'unmute',
        targetUserId: userId,
        timestamp: Date.now(),
      });

      trackEvent('user_unmuted', { unmuted_user_id: userId });

      return true;
    } catch (error) {
      console.error('[Moderation] Unmute failed:', error);
      return false;
    }
  }

  isUserMuted(userId: string): boolean {
    return this.mutedUsers.has(userId);
  }

  getMutedUserIds(): string[] {
    return Array.from(this.mutedUsers);
  }

  // ==========================================================================
  // Report User
  // ==========================================================================

  async reportUser(
    userId: string,
    reason: ReportReason,
    options: {
      description?: string;
      evidence?: ReportEvidence[];
      messageIds?: string[];
    } = {}
  ): Promise<ReportData | null> {
    try {
      const response = await api.post<ReportData>('/v1/reports', {
        reported_user_id: userId,
        reason,
        category: REPORT_REASONS[reason].category,
        description: options.description,
        evidence: options.evidence,
        message_ids: options.messageIds,
      });

      // Track locally
      this.reportedUsers.add(userId);
      await this.saveReportedUsers();

      // Log action
      await this.logModerationAction({
        type: 'report',
        targetUserId: userId,
        timestamp: Date.now(),
      });

      trackEvent('user_reported', {
        reported_user_id: userId,
        reason,
        category: REPORT_REASONS[reason].category,
        has_description: !!options.description,
        evidence_count: options.evidence?.length || 0,
      });

      return response.data;
    } catch (error) {
      console.error('[Moderation] Report failed:', error);
      analytics.trackError(error as Error, { action: 'report_user' });
      return null;
    }
  }

  async reportMessage(
    messageId: string,
    matchId: string,
    senderId: string,
    reason: ReportReason,
    description?: string
  ): Promise<boolean> {
    try {
      await api.post('/v1/reports/message', {
        message_id: messageId,
        match_id: matchId,
        sender_id: senderId,
        reason,
        description,
      });

      trackEvent('message_reported', {
        message_id: messageId,
        reason,
      });

      return true;
    } catch (error) {
      console.error('[Moderation] Message report failed:', error);
      return false;
    }
  }

  hasReportedUser(userId: string): boolean {
    return this.reportedUsers.has(userId);
  }

  // ==========================================================================
  // Safety Status
  // ==========================================================================

  getUserSafetyStatus(userId: string): UserSafetyStatus {
    return {
      isBlocked: this.isUserBlocked(userId),
      isMuted: this.isUserMuted(userId),
      hasReported: this.hasReportedUser(userId),
    };
  }

  // ==========================================================================
  // Moderation History
  // ==========================================================================

  private async logModerationAction(action: ModerationAction): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MODERATION_HISTORY);
      const history: ModerationAction[] = stored ? JSON.parse(stored) : [];

      history.unshift(action);

      // Keep last 100 actions
      const trimmed = history.slice(0, 100);

      await AsyncStorage.setItem(
        STORAGE_KEYS.MODERATION_HISTORY,
        JSON.stringify(trimmed)
      );
    } catch (error) {
      console.error('[Moderation] Failed to log action:', error);
    }
  }

  async getModerationHistory(): Promise<ModerationAction[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MODERATION_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // Sync with Server
  // ==========================================================================

  async syncWithServer(): Promise<void> {
    try {
      const response = await api.get<{
        blocked_users: Array<{
          user_id: string;
          user_name: string;
          user_photo?: string;
          blocked_at: string;
        }>;
        muted_users: string[];
      }>('/v1/users/moderation-status');

      // Sync blocked users
      this.blockedUsers.clear();
      response.data!.blocked_users.forEach((user) => {
        this.blockedUsers.set(user.user_id, {
          userId: user.user_id,
          userName: user.user_name,
          userPhoto: user.user_photo,
          blockedAt: user.blocked_at,
        });
      });
      await this.saveBlockedUsers();

      // Sync muted users
      this.mutedUsers.clear();
      response.data!.muted_users.forEach((id) => this.mutedUsers.add(id));
      await this.saveMutedUsers();

      console.log('[Moderation] Synced with server');
    } catch (error) {
      console.error('[Moderation] Sync failed:', error);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getReportReasons(): Array<{ value: ReportReason; label: string; description: string }> {
    return Object.entries(REPORT_REASONS).map(([value, data]) => ({
      value: value as ReportReason,
      label: data.label,
      description: data.description,
    }));
  }

  getBlockReasons(): Array<{ value: BlockReason; label: string }> {
    return Object.entries(BLOCK_REASONS).map(([value, label]) => ({
      value: value as BlockReason,
      label,
    }));
  }

  // ==========================================================================
  // Reset
  // ==========================================================================

  async reset(): Promise<void> {
    this.blockedUsers.clear();
    this.mutedUsers.clear();
    this.reportedUsers.clear();

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.BLOCKED_USERS,
      STORAGE_KEYS.MUTED_USERS,
      STORAGE_KEYS.REPORTED_USERS,
      STORAGE_KEYS.MODERATION_HISTORY,
    ]);
  }
}

export const moderationService = ModerationService.getInstance();
export default moderationService;

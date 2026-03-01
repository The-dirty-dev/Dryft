import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  moderationService,
  BlockedUser,
  ReportReason,
  BlockReason,
  UserSafetyStatus,
  ReportEvidence,
} from '../services/moderation';

// ============================================================================
// useBlockedUsers - Manage blocked users list
// ============================================================================

/**
 * React hook `useBlockedUsers`.
 * @returns Hook state and actions.
 * @example
 * const value = useBlockedUsers();
 */
export function useBlockedUsers() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBlockedUsers = async () => {
      await moderationService.initialize();
      setBlockedUsers(moderationService.getBlockedUsers());
      setIsLoading(false);
    };

    loadBlockedUsers();
  }, []);

  const blockUser = useCallback(
    async (
      userId: string,
      userName: string,
      userPhoto?: string,
      reason?: BlockReason
    ) => {
      const success = await moderationService.blockUser(
        userId,
        userName,
        userPhoto,
        reason
      );

      if (success) {
        setBlockedUsers(moderationService.getBlockedUsers());
      }

      return success;
    },
    []
  );

  const unblockUser = useCallback(async (userId: string) => {
    const success = await moderationService.unblockUser(userId);

    if (success) {
      setBlockedUsers(moderationService.getBlockedUsers());
    }

    return success;
  }, []);

  const isBlocked = useCallback((userId: string) => {
    return moderationService.isUserBlocked(userId);
  }, []);

  return {
    blockedUsers,
    blockedCount: blockedUsers.length,
    isLoading,
    blockUser,
    unblockUser,
    isBlocked,
  };
}

// ============================================================================
// useReportUser - Report user flow
// ============================================================================

/**
 * React hook `useReportUser`.
 * @param userId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useReportUser(userId);
 */
export function useReportUser(userId: string) {
  const [isReporting, setIsReporting] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasReported(moderationService.hasReportedUser(userId));
  }, [userId]);

  const report = useCallback(
    async (
      reason: ReportReason,
      options?: {
        description?: string;
        evidence?: ReportEvidence[];
        messageIds?: string[];
      }
    ) => {
      setIsReporting(true);
      setError(null);

      try {
        const result = await moderationService.reportUser(userId, reason, options);

        if (result) {
          setHasReported(true);
          return true;
        } else {
          setError('Failed to submit report');
          return false;
        }
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setIsReporting(false);
      }
    },
    [userId]
  );

  const reportReasons = useMemo(() => moderationService.getReportReasons(), []);

  return {
    report,
    isReporting,
    hasReported,
    error,
    reportReasons,
  };
}

// ============================================================================
// useUserSafetyStatus - Check user's moderation status
// ============================================================================

/**
 * React hook `useUserSafetyStatus`.
 * @param userId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useUserSafetyStatus(userId);
 */
export function useUserSafetyStatus(userId: string): UserSafetyStatus & { refresh: () => void } {
  const [status, setStatus] = useState<UserSafetyStatus>({
    isBlocked: false,
    isMuted: false,
    hasReported: false,
  });

  const refresh = useCallback(() => {
    setStatus(moderationService.getUserSafetyStatus(userId));
  }, [userId]);

  useEffect(() => {
    moderationService.initialize().then(refresh);
  }, [refresh]);

  return { ...status, refresh };
}

// ============================================================================
// useMuteUser - Mute/unmute user
// ============================================================================

/**
 * React hook `useMuteUser`.
 * @param userId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useMuteUser(userId);
 */
export function useMuteUser(userId: string) {
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    moderationService.initialize().then(() => {
      setIsMuted(moderationService.isUserMuted(userId));
    });
  }, [userId]);

  const mute = useCallback(async () => {
    setIsLoading(true);
    const success = await moderationService.muteUser(userId);
    if (success) {
      setIsMuted(true);
    }
    setIsLoading(false);
    return success;
  }, [userId]);

  const unmute = useCallback(async () => {
    setIsLoading(true);
    const success = await moderationService.unmuteUser(userId);
    if (success) {
      setIsMuted(false);
    }
    setIsLoading(false);
    return success;
  }, [userId]);

  const toggle = useCallback(async () => {
    return isMuted ? unmute() : mute();
  }, [isMuted, mute, unmute]);

  return {
    isMuted,
    isLoading,
    mute,
    unmute,
    toggle,
  };
}

// ============================================================================
// useBlockUser - Block/unblock user with confirmation
// ============================================================================

export function useBlockUser(
  userId: string,
  userName: string,
  userPhoto?: string
) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    moderationService.initialize().then(() => {
      setIsBlocked(moderationService.isUserBlocked(userId));
    });
  }, [userId]);

  const block = useCallback(
    async (reason?: BlockReason) => {
      setIsLoading(true);
      const success = await moderationService.blockUser(
        userId,
        userName,
        userPhoto,
        reason
      );
      if (success) {
        setIsBlocked(true);
      }
      setIsLoading(false);
      return success;
    },
    [userId, userName, userPhoto]
  );

  const unblock = useCallback(async () => {
    setIsLoading(true);
    const success = await moderationService.unblockUser(userId);
    if (success) {
      setIsBlocked(false);
    }
    setIsLoading(false);
    return success;
  }, [userId]);

  const blockReasons = useMemo(() => moderationService.getBlockReasons(), []);

  return {
    isBlocked,
    isLoading,
    block,
    unblock,
    blockReasons,
  };
}

// ============================================================================
// useModerationActions - Combined moderation actions for a user
// ============================================================================

export function useModerationActions(
  userId: string,
  userName: string,
  userPhoto?: string
) {
  const blockHook = useBlockUser(userId, userName, userPhoto);
  const muteHook = useMuteUser(userId);
  const reportHook = useReportUser(userId);
  const status = useUserSafetyStatus(userId);

  const isLoading = blockHook.isLoading || muteHook.isLoading || reportHook.isReporting;

  return {
    // Status
    isBlocked: blockHook.isBlocked,
    isMuted: muteHook.isMuted,
    hasReported: reportHook.hasReported,
    isLoading,

    // Block
    block: blockHook.block,
    unblock: blockHook.unblock,
    blockReasons: blockHook.blockReasons,

    // Mute
    mute: muteHook.mute,
    unmute: muteHook.unmute,
    toggleMute: muteHook.toggle,

    // Report
    report: reportHook.report,
    reportReasons: reportHook.reportReasons,
    reportError: reportHook.error,

    // Refresh
    refresh: status.refresh,
  };
}

export default {
  useBlockedUsers,
  useReportUser,
  useUserSafetyStatus,
  useMuteUser,
  useBlockUser,
  useModerationActions,
};

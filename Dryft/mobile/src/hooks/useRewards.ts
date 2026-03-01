import { useState, useEffect, useCallback } from 'react';
import * as rewardsService from '../services/rewards';
import type {
  DailyRewardStatus,
  ClaimResult,
  LeaderboardEntry,
} from '../services/rewards';

// =============================================================================
// Daily Rewards Hook
// =============================================================================

/**
 * React hook `useDailyRewards`.
 * @returns Hook state and actions.
 * @example
 * const value = useDailyRewards();
 */
export function useDailyRewards() {
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await rewardsService.getDailyRewardStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reward status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const claimReward = useCallback(async () => {
    if (claiming || status?.claimed_today) {
      return null;
    }

    try {
      setClaiming(true);
      setError(null);
      const result = await rewardsService.claimDailyReward();
      setClaimResult(result);

      // Update status to reflect claimed
      if (status) {
        setStatus({
          ...status,
          claimed_today: true,
          today_reward: null,
          streak: {
            ...status.streak,
            current: result.reward.streak_day,
            is_active: true,
            last_claim: new Date().toISOString(),
          },
          next_milestone: result.next_milestone,
        });
      }

      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to claim reward');
      return null;
    } finally {
      setClaiming(false);
    }
  }, [claiming, status]);

  const dismissClaimResult = useCallback(() => {
    setClaimResult(null);
  }, []);

  return {
    status,
    loading,
    claiming,
    claimResult,
    error,
    refresh: fetchStatus,
    claimReward,
    dismissClaimResult,
  };
}

// =============================================================================
// Rewards Leaderboard Hook
// =============================================================================

/**
 * React hook `useRewardsLeaderboard`.
 * @param type - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useRewardsLeaderboard(type);
 */
export function useRewardsLeaderboard(type: 'streak' | 'xp' = 'streak') {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userStats, setUserStats] = useState<{
    current_streak: number;
    longest_streak: number;
    xp: number;
    level: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await rewardsService.getRewardsLeaderboard(type);
      setLeaderboard(data.leaderboard);
      setUserRank(data.user_rank);
      setUserStats(data.user_stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { leaderboard, userRank, userStats, loading, error, refresh: fetchLeaderboard };
}

// =============================================================================
// Streak Status Hook (lightweight, for UI indicators)
// =============================================================================

/**
 * React hook `useStreakStatus`.
 * @returns Hook state and actions.
 * @example
 * const value = useStreakStatus();
 */
export function useStreakStatus() {
  const [streak, setStreak] = useState<{
    current: number;
    isActive: boolean;
    canClaim: boolean;
  }>({
    current: 0,
    isActive: false,
    canClaim: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchStreak = useCallback(async () => {
    try {
      setLoading(true);
      const data = await rewardsService.getDailyRewardStatus();
      setStreak({
        current: data.streak.current,
        isActive: data.streak.is_active,
        canClaim: !data.claimed_today,
      });
    } catch {
      // Silently fail for lightweight hook
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  return { ...streak, loading, refresh: fetchStreak };
}

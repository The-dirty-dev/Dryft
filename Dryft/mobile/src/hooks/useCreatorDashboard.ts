import { useState, useEffect, useCallback } from 'react';
import {
  creatorDashboardService,
  CreatorProfile,
  CreatorTier,
  TimePeriod,
  EngagementStats,
  AudienceInsights,
  ContentPerformance,
  EarningsBreakdown,
  PayoutInfo,
  CreatorGoal,
  Achievement,
  LeaderboardEntry,
} from '../services/creatorDashboard';

// ============================================================================
// useCreatorProfile - Creator profile and tier
// ============================================================================

/**
 * React hook `useCreatorProfile`.
 * @returns Hook state and actions.
 * @example
 * const value = useCreatorProfile();
 */
export function useCreatorProfile() {
  const [profile, setProfile] = useState<CreatorProfile | null>(
    creatorDashboardService.getProfile()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = creatorDashboardService.subscribe(() => {
      setProfile(creatorDashboardService.getProfile());
    });

    return unsubscribe;
  }, []);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      await creatorDashboardService.fetchProfile();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const tierProgress = creatorDashboardService.getProgressToNextTier();
  const nextTier = creatorDashboardService.getNextTier();
  const tierBenefits = creatorDashboardService.getTierBenefits();

  return {
    profile,
    isLoading,
    tier: profile?.tier || 'standard',
    tierColor: creatorDashboardService.getTierColor(profile?.tier || 'standard'),
    tierIcon: creatorDashboardService.getTierIcon(profile?.tier || 'standard'),
    tierBenefits,
    nextTier,
    tierProgress,
    totalEarnings: profile?.totalEarnings || 0,
    currentBalance: profile?.currentBalance || 0,
    followerCount: profile?.followerCount || 0,
    fetchProfile,
  };
}

// ============================================================================
// useEngagementStats - Engagement metrics
// ============================================================================

/**
 * React hook `useEngagementStats`.
 * @param period - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useEngagementStats(period);
 */
export function useEngagementStats(period: TimePeriod = 'week') {
  const [stats, setStats] = useState<EngagementStats | null>(
    creatorDashboardService.getCachedStats(period)
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await creatorDashboardService.fetchEngagementStats(period);
      setStats(data);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatChange = useCallback((change: number) => {
    return creatorDashboardService.formatChange(change);
  }, []);

  return {
    stats,
    isLoading,
    refresh: fetchStats,
    formatChange,
    formatNumber: creatorDashboardService.formatNumber,
  };
}

// ============================================================================
// useAudienceInsights - Audience demographics
// ============================================================================

/**
 * React hook `useAudienceInsights`.
 * @returns Hook state and actions.
 * @example
 * const value = useAudienceInsights();
 */
export function useAudienceInsights() {
  const [insights, setInsights] = useState<AudienceInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await creatorDashboardService.fetchAudienceInsights();
      setInsights(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    isLoading,
    refresh: fetchInsights,
    ageDistribution: insights?.ageDistribution || [],
    genderDistribution: insights?.genderDistribution || [],
    locationDistribution: insights?.locationDistribution || [],
    peakHours: insights?.peakHours || [],
    topInterests: insights?.topInterests || [],
  };
}

// ============================================================================
// useContentPerformance - Content analytics
// ============================================================================

/**
 * React hook `useContentPerformance`.
 * @returns Hook state and actions.
 * @example
 * const value = useContentPerformance();
 */
export function useContentPerformance() {
  const [performance, setPerformance] = useState<ContentPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPerformance = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await creatorDashboardService.fetchContentPerformance();
      setPerformance(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return {
    performance,
    isLoading,
    refresh: fetchPerformance,
    topPhotos: performance?.topPhotos || [],
    topStories: performance?.topStories || [],
    photoPerformance: performance?.photoPerformance || [],
  };
}

// ============================================================================
// useCreatorEarnings - Earnings and payouts
// ============================================================================

/**
 * React hook `useCreatorEarnings`.
 * @param period - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useCreatorEarnings(period);
 */
export function useCreatorEarnings(period: TimePeriod = 'month') {
  const [earnings, setEarnings] = useState<EarningsBreakdown | null>(null);
  const [payoutInfo, setPayoutInfo] = useState<PayoutInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  const fetchEarnings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [earningsData, payoutData] = await Promise.all([
        creatorDashboardService.fetchEarnings(period),
        creatorDashboardService.getPayoutInfo(),
      ]);
      setEarnings(earningsData);
      setPayoutInfo(payoutData);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const requestPayout = useCallback(async (amount: number) => {
    setIsRequestingPayout(true);
    try {
      const result = await creatorDashboardService.requestPayout(amount);
      if (result.success) {
        await fetchEarnings();
      }
      return result;
    } finally {
      setIsRequestingPayout(false);
    }
  }, [fetchEarnings]);

  const updatePayoutMethod = useCallback(
    async (method: PayoutInfo['method'], details: Record<string, string>) => {
      const success = await creatorDashboardService.updatePayoutMethod(method, details);
      if (success) {
        await fetchEarnings();
      }
      return success;
    },
    [fetchEarnings]
  );

  return {
    earnings,
    payoutInfo,
    isLoading,
    isRequestingPayout,
    refresh: fetchEarnings,
    requestPayout,
    updatePayoutMethod,
    formatEarnings: creatorDashboardService.formatEarnings,
    canRequestPayout:
      payoutInfo?.status === 'active' &&
      (earnings?.total || 0) >= (payoutInfo?.minimumPayout || 0),
  };
}

// ============================================================================
// useCreatorGoals - Goal tracking
// ============================================================================

/**
 * React hook `useCreatorGoals`.
 * @returns Hook state and actions.
 * @example
 * const value = useCreatorGoals();
 */
export function useCreatorGoals() {
  const [goals, setGoals] = useState<CreatorGoal[]>(
    creatorDashboardService.getGoals()
  );
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = creatorDashboardService.subscribe(() => {
      setGoals(creatorDashboardService.getGoals());
    });

    return unsubscribe;
  }, []);

  const createGoal = useCallback(
    async (type: CreatorGoal['type'], target: number, deadline?: string) => {
      setIsCreating(true);
      try {
        const goal = await creatorDashboardService.createGoal(type, target, deadline);
        return goal;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const updateProgress = useCallback(async (goalId: string, current: number) => {
    await creatorDashboardService.updateGoalProgress(goalId, current);
  }, []);

  const deleteGoal = useCallback(async (goalId: string) => {
    await creatorDashboardService.deleteGoal(goalId);
  }, []);

  const getGoalProgress = useCallback((goal: CreatorGoal) => {
    return (goal.current / goal.target) * 100;
  }, []);

  return {
    goals,
    isCreating,
    createGoal,
    updateProgress,
    deleteGoal,
    getGoalProgress,
    activeGoals: goals.filter((g) => g.current < g.target),
    completedGoals: goals.filter((g) => g.current >= g.target),
  };
}

// ============================================================================
// useCreatorAchievements - Achievements and rewards
// ============================================================================

/**
 * React hook `useCreatorAchievements`.
 * @returns Hook state and actions.
 * @example
 * const value = useCreatorAchievements();
 */
export function useCreatorAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const fetchAchievements = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await creatorDashboardService.fetchAchievements();
      setAchievements(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const claimReward = useCallback(async (achievementId: string) => {
    setIsClaiming(true);
    try {
      const success = await creatorDashboardService.claimAchievementReward(achievementId);
      if (success) {
        await fetchAchievements();
      }
      return success;
    } finally {
      setIsClaiming(false);
    }
  }, [fetchAchievements]);

  return {
    achievements,
    isLoading,
    isClaiming,
    refresh: fetchAchievements,
    claimReward,
    unlockedAchievements: achievements.filter((a) => a.unlockedAt),
    lockedAchievements: achievements.filter((a) => !a.unlockedAt),
    claimableAchievements: achievements.filter(
      (a) => a.unlockedAt && a.reward && a.progress >= a.target
    ),
  };
}

// ============================================================================
// useLeaderboard - Creator leaderboards
// ============================================================================

export function useLeaderboard(
  type: 'engagement' | 'earnings' | 'followers' = 'engagement',
  period: TimePeriod = 'week'
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await creatorDashboardService.fetchLeaderboard(type, period);
      setEntries(data.entries);
      setMyRank(data.myRank);
    } finally {
      setIsLoading(false);
    }
  }, [type, period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    entries,
    myRank,
    isLoading,
    refresh: fetchLeaderboard,
    top3: entries.slice(0, 3),
    formatNumber: creatorDashboardService.formatNumber,
  };
}

// ============================================================================
// useCreatorRecommendations - Profile improvement tips
// ============================================================================

/**
 * React hook `useCreatorRecommendations`.
 * @returns Hook state and actions.
 * @example
 * const value = useCreatorRecommendations();
 */
export function useCreatorRecommendations() {
  const [recommendations, setRecommendations] = useState<
    Array<{
      type: string;
      title: string;
      description: string;
      action?: string;
      priority: 'high' | 'medium' | 'low';
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await creatorDashboardService.fetchRecommendations();
      setRecommendations(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    isLoading,
    refresh: fetchRecommendations,
    highPriority: recommendations.filter((r) => r.priority === 'high'),
    mediumPriority: recommendations.filter((r) => r.priority === 'medium'),
    lowPriority: recommendations.filter((r) => r.priority === 'low'),
  };
}

// ============================================================================
// useTierProgress - Tier upgrade progress
// ============================================================================

/**
 * React hook `useTierProgress`.
 * @returns Hook state and actions.
 * @example
 * const value = useTierProgress();
 */
export function useTierProgress() {
  const { profile, tierProgress, nextTier, tierBenefits, tierColor, tierIcon } =
    useCreatorProfile();

  const currentTier = profile?.tier || 'standard';
  const nextTierBenefits = nextTier
    ? creatorDashboardService.getTierBenefits(nextTier)
    : [];

  const newBenefits = nextTierBenefits.filter(
    (benefit) => !tierBenefits.includes(benefit)
  );

  return {
    currentTier,
    currentTierColor: tierColor,
    currentTierIcon: tierIcon,
    nextTier,
    nextTierColor: nextTier ? creatorDashboardService.getTierColor(nextTier) : null,
    nextTierIcon: nextTier ? creatorDashboardService.getTierIcon(nextTier) : null,
    progress: tierProgress,
    currentBenefits: tierBenefits,
    newBenefitsOnUpgrade: newBenefits,
    isMaxTier: !nextTier,
  };
}

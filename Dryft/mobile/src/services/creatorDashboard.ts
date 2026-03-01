import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type CreatorTier = 'standard' | 'rising' | 'established' | 'elite';
export type TimePeriod = 'today' | 'week' | 'month' | 'all_time';

export interface CreatorProfile {
  userId: string;
  tier: CreatorTier;
  isVerified: boolean;
  joinedAt: string;
  totalEarnings: number;
  currentBalance: number;
  pendingPayout: number;
  followerCount: number;
  subscriberCount: number;
}

export interface EngagementStats {
  period: TimePeriod;
  profileViews: number;
  profileViewsChange: number;
  likes: number;
  likesChange: number;
  matches: number;
  matchesChange: number;
  messages: number;
  messagesChange: number;
  superLikes: number;
  superLikesChange: number;
  storyViews: number;
  storyViewsChange: number;
  giftsReceived: number;
  giftsReceivedChange: number;
}

export interface AudienceInsights {
  ageDistribution: Array<{ range: string; percentage: number }>;
  genderDistribution: Array<{ gender: string; percentage: number }>;
  locationDistribution: Array<{ location: string; percentage: number }>;
  peakHours: Array<{ hour: number; engagement: number }>;
  topInterests: Array<{ interest: string; count: number }>;
}

export interface ContentPerformance {
  topPhotos: Array<{
    id: string;
    url: string;
    views: number;
    likes: number;
    engagement: number;
  }>;
  topStories: Array<{
    id: string;
    thumbnailUrl: string;
    views: number;
    reactions: number;
    replies: number;
  }>;
  photoPerformance: Array<{
    photoIndex: number;
    impressions: number;
    swipeRightRate: number;
  }>;
}

export interface EarningsBreakdown {
  period: TimePeriod;
  total: number;
  gifts: number;
  subscriptions: number;
  tips: number;
  referrals: number;
  bonuses: number;
  history: Array<{
    date: string;
    amount: number;
    type: string;
    description: string;
  }>;
}

export interface PayoutInfo {
  method: 'bank' | 'paypal' | 'stripe';
  status: 'active' | 'pending' | 'disabled';
  lastPayout?: {
    amount: number;
    date: string;
    status: 'completed' | 'processing' | 'failed';
  };
  minimumPayout: number;
  nextPayoutDate?: string;
}

export interface CreatorGoal {
  id: string;
  type: 'followers' | 'matches' | 'earnings' | 'engagement';
  target: number;
  current: number;
  deadline?: string;
  reward?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress: number;
  target: number;
  reward?: {
    type: 'badge' | 'boost' | 'coins';
    value: string | number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userPhoto: string;
  score: number;
  tier: CreatorTier;
  change: number; // Position change
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  CREATOR_PROFILE: 'dryft_creator_profile',
  CACHED_STATS: 'dryft_creator_stats_cache',
  GOALS: 'dryft_creator_goals',
};

const TIER_THRESHOLDS = {
  rising: 100, // 100+ followers
  established: 1000, // 1000+ followers
  elite: 10000, // 10000+ followers
};

const TIER_BENEFITS: Record<CreatorTier, string[]> = {
  standard: ['Basic analytics', 'Profile insights'],
  rising: ['Advanced analytics', 'Priority support', 'Custom badge'],
  established: ['Full analytics suite', 'Revenue share', 'Verified badge', 'Featured placement'],
  elite: ['VIP support', 'Maximum revenue share', 'Elite badge', 'Exclusive events'],
};

// ============================================================================
// Creator Dashboard Service
// ============================================================================

class CreatorDashboardService {
  private static instance: CreatorDashboardService;
  private profile: CreatorProfile | null = null;
  private cachedStats: Map<TimePeriod, EngagementStats> = new Map();
  private goals: CreatorGoal[] = [];
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): CreatorDashboardService {
    if (!CreatorDashboardService.instance) {
      CreatorDashboardService.instance = new CreatorDashboardService();
    }
    return CreatorDashboardService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadProfile(),
      this.loadCachedStats(),
      this.loadGoals(),
    ]);

    this.initialized = true;
    console.log('[CreatorDashboard] Initialized');
  }

  private async loadProfile(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CREATOR_PROFILE);
      if (stored) {
        this.profile = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[CreatorDashboard] Failed to load profile:', error);
    }
  }

  private async saveProfile(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CREATOR_PROFILE,
        JSON.stringify(this.profile)
      );
    } catch (error) {
      console.error('[CreatorDashboard] Failed to save profile:', error);
    }
  }

  private async loadCachedStats(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_STATS);
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([period, stats]) => {
          this.cachedStats.set(period as TimePeriod, stats as EngagementStats);
        });
      }
    } catch (error) {
      console.error('[CreatorDashboard] Failed to load cached stats:', error);
    }
  }

  private async saveCachedStats(): Promise<void> {
    try {
      const data = Object.fromEntries(this.cachedStats);
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_STATS, JSON.stringify(data));
    } catch (error) {
      console.error('[CreatorDashboard] Failed to save cached stats:', error);
    }
  }

  private async loadGoals(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GOALS);
      if (stored) {
        this.goals = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[CreatorDashboard] Failed to load goals:', error);
    }
  }

  private async saveGoals(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(this.goals));
    } catch (error) {
      console.error('[CreatorDashboard] Failed to save goals:', error);
    }
  }

  // ==========================================================================
  // Profile
  // ==========================================================================

  async fetchProfile(): Promise<CreatorProfile | null> {
    try {
      const response = await api.get<CreatorProfile>('/v1/creator/profile');
      this.profile = response.data;
      await this.saveProfile();
      this.notifyListeners();
      return this.profile;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch profile:', error);
      return this.profile;
    }
  }

  getProfile(): CreatorProfile | null {
    return this.profile;
  }

  getTier(): CreatorTier {
    return this.profile?.tier || 'standard';
  }

  getTierBenefits(tier?: CreatorTier): string[] {
    return TIER_BENEFITS[tier || this.getTier()];
  }

  getNextTier(): CreatorTier | null {
    const currentTier = this.getTier();
    const tiers: CreatorTier[] = ['standard', 'rising', 'established', 'elite'];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  }

  getProgressToNextTier(): { current: number; required: number; percentage: number } | null {
    const nextTier = this.getNextTier();
    if (!nextTier || !this.profile) return null;

    const required = TIER_THRESHOLDS[nextTier];
    const current = this.profile.followerCount;
    const percentage = Math.min((current / required) * 100, 100);

    return { current, required, percentage };
  }

  // ==========================================================================
  // Engagement Stats
  // ==========================================================================

  async fetchEngagementStats(period: TimePeriod = 'week'): Promise<EngagementStats | null> {
    try {
      const response = await api.get<EngagementStats>('/v1/creator/stats/engagement', {
        params: { period },
      });

      this.cachedStats.set(period, response.data);
      await this.saveCachedStats();

      return response.data;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch engagement stats:', error);
      return this.cachedStats.get(period) || null;
    }
  }

  getCachedStats(period: TimePeriod): EngagementStats | null {
    return this.cachedStats.get(period) || null;
  }

  // ==========================================================================
  // Audience Insights
  // ==========================================================================

  async fetchAudienceInsights(): Promise<AudienceInsights | null> {
    try {
      const response = await api.get<AudienceInsights>('/v1/creator/insights/audience');
      return response.data;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch audience insights:', error);
      return null;
    }
  }

  // ==========================================================================
  // Content Performance
  // ==========================================================================

  async fetchContentPerformance(): Promise<ContentPerformance | null> {
    try {
      const response = await api.get<ContentPerformance>('/v1/creator/insights/content');
      return response.data;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch content performance:', error);
      return null;
    }
  }

  // ==========================================================================
  // Earnings
  // ==========================================================================

  async fetchEarnings(period: TimePeriod = 'month'): Promise<EarningsBreakdown | null> {
    try {
      const response = await api.get<EarningsBreakdown>('/v1/creator/earnings', {
        params: { period },
      });
      return response.data;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch earnings:', error);
      return null;
    }
  }

  async requestPayout(amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      await api.post('/v1/creator/payout/request', { amount });

      trackEvent('payout_requested', { amount });

      if (this.profile) {
        this.profile.pendingPayout = (this.profile.pendingPayout || 0) + amount;
        this.profile.currentBalance -= amount;
        await this.saveProfile();
        this.notifyListeners();
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getPayoutInfo(): Promise<PayoutInfo | null> {
    try {
      const response = await api.get<PayoutInfo>('/v1/creator/payout/info');
      return response.data;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch payout info:', error);
      return null;
    }
  }

  async updatePayoutMethod(
    method: PayoutInfo['method'],
    details: Record<string, string>
  ): Promise<boolean> {
    try {
      await api.post('/v1/creator/payout/method', { method, details });
      trackEvent('payout_method_updated', { method });
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // Goals
  // ==========================================================================

  getGoals(): CreatorGoal[] {
    return [...this.goals];
  }

  async createGoal(
    type: CreatorGoal['type'],
    target: number,
    deadline?: string
  ): Promise<CreatorGoal> {
    const goal: CreatorGoal = {
      id: `goal_${Date.now()}`,
      type,
      target,
      current: 0,
      deadline,
    };

    try {
      const response = await api.post<{ goal: CreatorGoal }>('/v1/creator/goals', {
        type,
        target,
        deadline,
      });
      goal.id = response.data!.goal.id;
    } catch (error) {
      // Create locally if server fails
    }

    this.goals.push(goal);
    await this.saveGoals();

    trackEvent('creator_goal_created', { type, target });

    this.notifyListeners();

    return goal;
  }

  async updateGoalProgress(goalId: string, current: number): Promise<void> {
    const goal = this.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.current = current;
      await this.saveGoals();
      this.notifyListeners();
    }
  }

  async deleteGoal(goalId: string): Promise<void> {
    this.goals = this.goals.filter((g) => g.id !== goalId);
    await this.saveGoals();

    try {
      await api.delete(`/v1/creator/goals/${goalId}`);
    } catch (error) {
      // Ignore
    }

    this.notifyListeners();
  }

  // ==========================================================================
  // Achievements
  // ==========================================================================

  async fetchAchievements(): Promise<Achievement[]> {
    try {
      const response = await api.get<{ achievements: Achievement[] }>(
        '/v1/creator/achievements'
      );
      return response.data!.achievements;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch achievements:', error);
      return [];
    }
  }

  async claimAchievementReward(achievementId: string): Promise<boolean> {
    try {
      await api.post(`/v1/creator/achievements/${achievementId}/claim`);
      trackEvent('achievement_reward_claimed', { achievement_id: achievementId });
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // Leaderboard
  // ==========================================================================

  async fetchLeaderboard(
    type: 'engagement' | 'earnings' | 'followers' = 'engagement',
    period: TimePeriod = 'week'
  ): Promise<{ entries: LeaderboardEntry[]; myRank?: LeaderboardEntry }> {
    try {
      const response = await api.get<{
        entries: LeaderboardEntry[];
        my_rank?: LeaderboardEntry;
      }>('/v1/creator/leaderboard', {
        params: { type, period },
      });

      return {
        entries: response.data!.entries,
        myRank: response.data!.my_rank,
      };
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch leaderboard:', error);
      return { entries: [] };
    }
  }

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  async fetchRecommendations(): Promise<Array<{
    type: string;
    title: string;
    description: string;
    action?: string;
    priority: 'high' | 'medium' | 'low';
  }>> {
    try {
      const response = await api.get<{
        recommendations: Array<{
          type: string;
          title: string;
          description: string;
          action?: string;
          priority: 'high' | 'medium' | 'low';
        }>;
      }>('/v1/creator/recommendations');

      return response.data!.recommendations;
    } catch (error) {
      console.error('[CreatorDashboard] Failed to fetch recommendations:', error);
      return [];
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  formatEarnings(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  formatChange(change: number): { text: string; isPositive: boolean } {
    const isPositive = change >= 0;
    const text = `${isPositive ? '+' : ''}${change.toFixed(1)}%`;
    return { text, isPositive };
  }

  getTierColor(tier: CreatorTier): string {
    const colors: Record<CreatorTier, string> = {
      standard: '#6B7280',
      rising: '#3B82F6',
      established: '#8B5CF6',
      elite: '#F59E0B',
    };
    return colors[tier];
  }

  getTierIcon(tier: CreatorTier): string {
    const icons: Record<CreatorTier, string> = {
      standard: 'person',
      rising: 'trending-up',
      established: 'star',
      elite: 'diamond',
    };
    return icons[tier];
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const creatorDashboardService = CreatorDashboardService.getInstance();
export default creatorDashboardService;

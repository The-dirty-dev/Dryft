import apiClient from '../api/client';

// =============================================================================
// Types
// =============================================================================

export interface StreakInfo {
  current: number;
  is_active: boolean;
  last_claim: string | null;
}

export interface TodayReward {
  xp: number;
  base_xp: number;
  streak_bonus: number;
  coins: number;
  streak_day: number;
  milestone_reward: {
    title: string;
    xp: number;
    badge?: string | null;
    streak_day: number;
  } | null;
}

export interface NextMilestone {
  days: number;
  days_away: number;
  xp_reward: number;
  title: string;
  badge?: string | null;
}

export interface RewardHistoryItem {
  date: string;
  streak_day: number;
  xp_earned: number;
  coins_earned: number;
}

export interface DailyRewardStatus {
  claimed_today: boolean;
  streak: StreakInfo;
  today_reward: TodayReward | null;
  next_milestone: NextMilestone | null;
  history: RewardHistoryItem[];
}

export interface ClaimResult {
  success: boolean;
  reward: {
    xp_earned: number;
    base_xp: number;
    streak_bonus: number;
    milestone_bonus: number;
    coins_earned: number;
    streak_day: number;
    milestone_reached: {
      title: string;
      badge: string | null;
      xp: number;
    } | null;
  };
  next_milestone: NextMilestone | null;
}

export interface LeaderboardEntry {
  rank: number;
  couple_id: string;
  partners: Array<{
    id: string;
    display_name: string | null;
    profile_photo: string | null;
  }>;
  current_streak: number;
  longest_streak: number;
  xp: number;
  level: number;
  is_current_user: boolean;
}

export interface LeaderboardResponse {
  type: string;
  leaderboard: LeaderboardEntry[];
  user_rank: number | null;
  user_stats: {
    current_streak: number;
    longest_streak: number;
    xp: number;
    level: number;
  } | null;
}

// =============================================================================
// API Functions
// =============================================================================

export async function getDailyRewardStatus(): Promise<DailyRewardStatus> {
  const response = await apiClient.get<DailyRewardStatus>('/v1/rewards/daily');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch reward status');
  }
  return response.data;
}

export async function claimDailyReward(): Promise<ClaimResult> {
  const response = await apiClient.post<ClaimResult>('/v1/rewards/daily/claim');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to claim reward');
  }
  return response.data;
}

export async function getRewardsLeaderboard(
  type: 'streak' | 'xp' = 'streak'
): Promise<LeaderboardResponse> {
  const response = await apiClient.get<LeaderboardResponse>(`/v1/rewards/leaderboard?type=${type}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch leaderboard');
  }
  return response.data;
}

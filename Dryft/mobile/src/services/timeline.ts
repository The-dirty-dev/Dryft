import apiClient from '../api/client';

// =============================================================================
// Types
// =============================================================================

export interface TimelineEvent {
  id: string;
  type: 'milestone' | 'memory' | 'achievement' | 'activity' | 'auto';
  category?: string;
  title: string;
  description?: string | null;
  date: string;
  photo_url?: string | null;
  media_url?: string | null;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export interface UpcomingMilestone {
  title: string;
  date: string;
  days_until: number;
  icon: string;
}

export interface TimelineStats {
  days_together: number;
  milestones_count: number;
  memories_count: number;
  achievements_count: number;
  activities_completed: number;
}

export interface TimelineResponse {
  timeline: TimelineEvent[];
  stats: TimelineStats;
  upcoming: UpcomingMilestone[];
  partner: {
    id: string;
    display_name: string | null;
    profile_photo: string | null;
  };
  total: number;
  has_more: boolean;
}

export interface ThrowbackItem {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  media_url?: string | null;
  photo_url?: string | null;
  date: string;
}

export interface ThrowbackYear {
  year: number;
  years_ago: number;
  items: ThrowbackItem[];
}

export interface ThrowbackResponse {
  date: string;
  has_throwbacks: boolean;
  throwbacks: ThrowbackYear[];
}

export interface TimelineSummary {
  days_together: number;
  weeks_together: number;
  months_together: number;
  started_date: string;
  anniversary: string | null;
  upcoming: UpcomingMilestone[];
  recent_highlights: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    icon: string;
  }>;
  partner: {
    display_name: string | null;
    profile_photo: string | null;
  };
}

// =============================================================================
// API Functions
// =============================================================================

export async function getTimeline(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<TimelineResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  if (params?.type) query.set('type', params.type);

  const response = await apiClient.get<TimelineResponse>(`/v1/timeline?${query}`);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch timeline');
  }
  return response.data;
}

export async function getThrowbacks(): Promise<ThrowbackResponse> {
  const response = await apiClient.get<ThrowbackResponse>('/v1/timeline/throwback');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch throwbacks');
  }
  return response.data;
}

export async function getTimelineSummary(): Promise<TimelineSummary> {
  const response = await apiClient.get<TimelineSummary>('/v1/timeline/summary');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch timeline summary');
  }
  return response.data;
}

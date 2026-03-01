import apiClient from './client';
import { ApiResponse } from '../types';

export interface AnalyticsEvent {
  event: string;
  user_id?: string;
  session_id?: string;
  timestamp?: string;
  properties?: Record<string, unknown>;
}

export interface EventBatch {
  events: AnalyticsEvent[];
}

export const analyticsApi = {
  /**
   * Send a batch of analytics events.
   */
  async sendEvents(batch: EventBatch): Promise<ApiResponse<{ status: string; count: number }>> {
    return apiClient.post<{ status: string; count: number }>('/v1/analytics/events', batch);
  },
};

export default analyticsApi;

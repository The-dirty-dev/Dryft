import apiClient from './client';
import {
  ApiResponse,
  DiscoverResponse,
  MatchesResponse,
  SwipeResult,
} from '../types';

export type SwipeDirection = 'like' | 'pass';

export const matchingApi = {
  /**
   * Get discover profiles for swiping.
   */
  async getDiscoverProfiles(limit = 20): Promise<ApiResponse<DiscoverResponse>> {
    return apiClient.get<DiscoverResponse>(`/v1/discover?limit=${limit}`);
  },

  /**
   * Submit a swipe action.
   */
  async swipe(
    userId: string,
    direction: SwipeDirection
  ): Promise<ApiResponse<SwipeResult>> {
    return apiClient.post<SwipeResult>('/v1/discover/swipe', {
      user_id: userId,
      direction,
    });
  },

  /**
   * Get current matches.
   */
  async getMatches(): Promise<ApiResponse<MatchesResponse>> {
    return apiClient.get<MatchesResponse>('/v1/matches');
  },

  /**
   * Remove a match.
   */
  async unmatch(matchId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/v1/matches/${matchId}`);
  },
};

export default matchingApi;

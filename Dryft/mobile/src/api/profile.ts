import apiClient from './client';
import { ApiResponse } from '../types';

export interface ProfileData {
  display_name?: string;
  bio?: string;
  birth_date?: string;
  gender?: string;
  looking_for?: string[];
  interests?: string[];
  job_title?: string;
  company?: string;
  school?: string;
  height?: number;
  profile_photo_url?: string;
  photos?: string[];
}

export const profileApi = {
  /**
   * Get the current user's profile data.
   */
  async getProfile(): Promise<ApiResponse<ProfileData>> {
    return apiClient.get<ProfileData>('/v1/profile');
  },

  /**
   * Update the current user's profile data.
   */
  async updateProfile(data: Partial<ProfileData>): Promise<ApiResponse<ProfileData>> {
    return apiClient.patch<ProfileData>('/v1/profile', data);
  },
};

export default profileApi;

import apiClient from './client';
import { ApiResponse } from '../types';

export interface AvatarState {
  user_id: string;
  equipped_avatar?: string;
  equipped_outfit?: string;
  equipped_effect?: string;
  skin_tone?: string;
  hair_color?: string;
  eye_color?: string;
  display_name?: string;
  is_visible?: boolean;
  updated_at?: string;
}

export interface UpdateAvatarRequest {
  equipped_avatar?: string;
  equipped_outfit?: string;
  equipped_effect?: string;
  skin_tone?: string;
  hair_color?: string;
  eye_color?: string;
  display_name?: string;
  is_visible?: boolean;
}

export const avatarApi = {
  /**
   * Get current user's avatar state.
   */
  async getMyAvatar(): Promise<ApiResponse<AvatarState>> {
    return apiClient.get<AvatarState>('/v1/avatar');
  },

  /**
   * Update avatar state.
   */
  async updateAvatar(data: UpdateAvatarRequest): Promise<ApiResponse<AvatarState>> {
    return apiClient.put<AvatarState>('/v1/avatar', data);
  },

  /**
   * Equip an avatar item.
   */
  async equipItem(itemId: string, itemType: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/avatar/equip', {
      item_id: itemId,
      item_type: itemType,
    });
  },

  /**
   * Unequip an avatar item.
   */
  async unequipItem(itemId: string, itemType: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/avatar/unequip', {
      item_id: itemId,
      item_type: itemType,
    });
  },

  /**
   * Update avatar colors.
   */
  async setColors(colors: { skin_tone?: string; hair_color?: string; eye_color?: string }): Promise<ApiResponse<{ status: string }>> {
    return apiClient.put<{ status: string }>('/v1/avatar/colors', colors);
  },

  /**
   * Update avatar display name.
   */
  async setDisplayName(display_name: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.put<{ status: string }>('/v1/avatar/name', { display_name });
  },

  /**
   * Update avatar visibility.
   */
  async setVisibility(is_visible: boolean): Promise<ApiResponse<{ status: string }>> {
    return apiClient.put<{ status: string }>('/v1/avatar/visibility', { is_visible });
  },

  /**
   * Get another user's avatar state.
   */
  async getUserAvatar(userId: string): Promise<ApiResponse<AvatarState>> {
    return apiClient.get<AvatarState>(`/v1/avatar/user/${userId}`);
  },

  /**
   * Batch get avatars for multiple users.
   */
  async getAvatars(userIds: string[]): Promise<ApiResponse<{ avatars: AvatarState[] }>> {
    return apiClient.post<{ avatars: AvatarState[] }>('/v1/avatar/batch', { user_ids: userIds });
  },

  /**
   * Get avatar equip history.
   */
  async getHistory(): Promise<ApiResponse<{ history: AvatarState[] }>> {
    return apiClient.get<{ history: AvatarState[] }>('/v1/avatar/history');
  },
};

export default avatarApi;

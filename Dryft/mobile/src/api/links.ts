import apiClient from './client';
import { ApiResponse } from '../types';

export interface CreateLinkRequest {
  type: string;
  target_id?: string;
  metadata?: Record<string, string>;
  expires_in_seconds?: number;
  max_uses?: number;
}

export interface LinkRecord {
  id: string;
  code: string;
  type: string;
  target_id?: string;
  metadata?: Record<string, string>;
  uses?: number;
  max_uses?: number;
  expires_at?: string;
  created_at?: string;
}

export interface CreateLinkResponse {
  link: LinkRecord;
  url: string;
}

export interface LinkResponse {
  valid: boolean;
  link?: LinkRecord;
  url?: string;
  error?: string;
  expires_at?: string;
}

export interface VRInviteResponse {
  valid: boolean;
  invite_code?: string;
  host_id?: string;
  host_name?: string;
  guest_id?: string;
  room_id?: string;
  room_type?: string;
  status?: string;
  expires_at?: number;
  url?: string;
  error?: string;
}

export const linksApi = {
  /**
   * Create a generic shareable link.
   */
  async createLink(data: CreateLinkRequest): Promise<ApiResponse<CreateLinkResponse>> {
    return apiClient.post<CreateLinkResponse>('/v1/links', data);
  },

  /**
   * Get link details by code.
   */
  async getLink(code: string): Promise<ApiResponse<LinkResponse>> {
    return apiClient.get<LinkResponse>(`/v1/links/${code}`);
  },

  /**
   * Validate link by code.
   */
  async validateLink(code: string): Promise<ApiResponse<LinkResponse>> {
    return apiClient.post<LinkResponse>(`/v1/links/${code}/validate`);
  },

  /**
   * Use a link by code.
   */
  async useLink(code: string): Promise<ApiResponse<LinkResponse>> {
    return apiClient.post<LinkResponse>(`/v1/links/${code}/use`);
  },

  /**
   * Create a profile share link.
   */
  async createProfileLink(): Promise<ApiResponse<CreateLinkResponse>> {
    return apiClient.post<CreateLinkResponse>('/v1/links/profile');
  },

  /**
   * Create a VR invite.
   */
  async createVRInvite(data: { guest_id?: string; room_type?: string; expires_in_seconds?: number }): Promise<ApiResponse<VRInviteResponse>> {
    return apiClient.post<VRInviteResponse>('/v1/links/vr-invite', data);
  },

  /**
   * Get VR invite by code.
   */
  async getVRInvite(code: string): Promise<ApiResponse<VRInviteResponse>> {
    return apiClient.get<VRInviteResponse>(`/v1/links/vr-invite/${code}`);
  },

  /**
   * Validate VR invite.
   */
  async validateVRInvite(code: string): Promise<ApiResponse<VRInviteResponse>> {
    return apiClient.get<VRInviteResponse>(`/v1/links/vr-invite/${code}/validate`);
  },

  /**
   * Accept VR invite.
   */
  async acceptVRInvite(code: string): Promise<ApiResponse<VRInviteResponse>> {
    return apiClient.post<VRInviteResponse>(`/v1/links/vr-invite/${code}/accept`);
  },

  /**
   * Decline VR invite.
   */
  async declineVRInvite(code: string): Promise<ApiResponse<VRInviteResponse>> {
    return apiClient.post<VRInviteResponse>(`/v1/links/vr-invite/${code}/decline`);
  },

  /**
   * Cancel VR invite.
   */
  async cancelVRInvite(code: string): Promise<ApiResponse<VRInviteResponse>> {
    return apiClient.post<VRInviteResponse>(`/v1/links/vr-invite/${code}/cancel`);
  },
};

export default linksApi;

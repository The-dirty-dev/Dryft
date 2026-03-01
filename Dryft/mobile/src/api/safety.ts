import apiClient from './client';
import { ApiResponse } from '../types';

export interface BlockRequest {
  user_id: string;
  reason?: string;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  reason?: string;
  created_at: string;
}

export interface ReportRequest {
  reported_user_id: string;
  category: string;
  reason: string;
  description?: string;
  evidence_urls?: string[];
  session_id?: string;
}

export interface ReportSummary {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  category: string;
  reason: string;
  description?: string;
  status?: string;
  created_at: string;
}

export interface Warning {
  id: string;
  user_id: string;
  reason: string;
  issued_at: string;
  expires_at?: string;
}

export const safetyApi = {
  /**
   * Block a user.
   */
  async blockUser(data: BlockRequest): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.post<{ success: boolean; message: string }>('/v1/safety/block', data);
  },

  /**
   * Unblock a user.
   */
  async unblockUser(userId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.delete<{ success: boolean; message: string }>(`/v1/safety/block/${userId}`);
  },

  /**
   * Get blocked users list.
   */
  async getBlockedUsers(): Promise<ApiResponse<{ blocked_users: BlockedUser[]; count: number }>> {
    return apiClient.get<{ blocked_users: BlockedUser[]; count: number }>('/v1/safety/blocked');
  },

  /**
   * Check if a user is blocked.
   */
  async checkBlocked(userId: string): Promise<ApiResponse<{ is_blocked: boolean }>> {
    return apiClient.get<{ is_blocked: boolean }>(`/v1/safety/blocked/${userId}/check`);
  },

  /**
   * Submit a safety report.
   */
  async submitReport(data: ReportRequest): Promise<ApiResponse<{ report_id: string; message: string }>> {
    return apiClient.post<{ report_id: string; message: string }>('/v1/safety/report', data);
  },

  /**
   * Get the current user's reports.
   */
  async getMyReports(): Promise<ApiResponse<{ reports: ReportSummary[] }>> {
    return apiClient.get<{ reports: ReportSummary[] }>('/v1/safety/reports');
  },

  /**
   * Trigger a panic alert.
   */
  async sendPanic(): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.post<{ success: boolean }>('/v1/safety/panic');
  },

  /**
   * Get warnings issued to the current user.
   */
  async getWarnings(): Promise<ApiResponse<{ warnings: Warning[] }>> {
    return apiClient.get<{ warnings: Warning[] }>('/v1/safety/warnings');
  },
};

export default safetyApi;

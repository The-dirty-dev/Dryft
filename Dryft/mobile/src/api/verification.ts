import apiClient from './client';
import { ApiResponse } from '../types';

export interface VerificationStatusResponse {
  verifications: VerificationResponse[];
  trust_score: number;
  is_verified: boolean;
}

export interface VerificationResponse {
  type: string;
  status: string;
  submitted_at?: string;
  reviewed_at?: string;
  expires_at?: string;
  rejection_reason?: string;
}

export const verificationApi = {
  /**
   * Get verification status and trust score.
   */
  async getStatus(): Promise<ApiResponse<VerificationStatusResponse>> {
    return apiClient.get<VerificationStatusResponse>('/v1/verification/status');
  },

  /**
   * Get trust score.
   */
  async getTrustScore(): Promise<ApiResponse<{ trust_score: number }>> {
    return apiClient.get<{ trust_score: number }>('/v1/verification/score');
  },

  /**
   * Submit a photo verification.
   */
  async submitPhoto(data: { photo_url: string }): Promise<ApiResponse<VerificationResponse>> {
    return apiClient.post<VerificationResponse>('/v1/verification/photo', data);
  },

  /**
   * Send phone verification code.
   */
  async sendPhoneCode(phone_number: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/verification/phone/send', { phone_number });
  },

  /**
   * Verify phone code.
   */
  async verifyPhoneCode(phone_number: string, code: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/verification/phone/verify', {
      phone_number,
      code,
    });
  },

  /**
   * Send email verification link/code.
   */
  async sendEmailVerification(email: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/verification/email/send', { email });
  },

  /**
   * Verify email code.
   */
  async verifyEmailCode(email: string, code: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/verification/email/verify', { email, code });
  },

  /**
   * Submit ID verification.
   */
  async submitIdVerification(data: Record<string, unknown>): Promise<ApiResponse<VerificationResponse>> {
    return apiClient.post<VerificationResponse>('/v1/verification/id', data);
  },

  /**
   * Connect social account verification.
   */
  async connectSocialAccount(data: Record<string, unknown>): Promise<ApiResponse<VerificationResponse>> {
    return apiClient.post<VerificationResponse>('/v1/verification/social', data);
  },
};

export default verificationApi;

import apiClient from './client';
import { ApiResponse } from '../types';

export interface InitiateCallRequest {
  match_id: string;
  video_enabled: boolean;
}

export interface InitiateCallResponse {
  call_id: string;
  match_id: string;
  callee_id: string;
  video_enabled: boolean;
}

export type CallState = 'ringing' | 'connected' | 'ended';

export interface ActiveCall {
  id: string;
  caller_id: string;
  callee_id: string;
  match_id: string;
  video_enabled: boolean;
  state: CallState;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
}

export interface ActiveCallStatus {
  active: boolean;
  call?: ActiveCall;
}

export const callsApi = {
  /**
   * Initiate a call for a match.
   */
  async initiateCall(
    data: InitiateCallRequest
  ): Promise<ApiResponse<InitiateCallResponse>> {
    return apiClient.post<InitiateCallResponse>('/v1/calls/initiate', data);
  },

  /**
   * Get the active call for the current user.
   */
  async getActiveCall(): Promise<ApiResponse<ActiveCallStatus>> {
    return apiClient.get<ActiveCallStatus>('/v1/calls/active');
  },

  /**
   * Get call history.
   */
  async getCallHistory(): Promise<ApiResponse<{ calls: ActiveCall[] }>> {
    return apiClient.get<{ calls: ActiveCall[] }>('/v1/calls/history');
  },

  /**
   * End an active call.
   */
  async endCall(callId: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>(`/v1/calls/${callId}/end`);
  },
};

export default callsApi;

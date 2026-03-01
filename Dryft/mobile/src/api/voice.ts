import apiClient from './client';
import { ApiResponse } from '../types';

export interface VoiceParticipant {
  user_id: string;
  display_name: string;
  is_speaking: boolean;
  is_muted: boolean;
  joined_at: string;
}

export interface VoiceParticipantsResponse {
  participants: VoiceParticipant[];
}

export const voiceApi = {
  /**
   * Get participants for a voice session.
   */
  async getParticipants(sessionId: string): Promise<ApiResponse<VoiceParticipantsResponse>> {
    return apiClient.get<VoiceParticipantsResponse>(
      `/v1/voice/session/${sessionId}/participants`
    );
  },
};

export default voiceApi;

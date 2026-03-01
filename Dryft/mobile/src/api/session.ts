import apiClient from './client';

// =============================================================================
// Types
// =============================================================================

export type DeviceType = 'vr' | 'mobile' | 'web';
export type SessionStatus = 'active' | 'ended' | 'expired';

export interface SessionUser {
  user_id: string;
  display_name: string;
  photo_url?: string;
  device_type: DeviceType;
  is_host: boolean;
  joined_at: number;
}

export interface CompanionSession {
  id: string;
  host_id: string;
  session_code: string;
  status: SessionStatus;
  max_participants: number;
  vr_device_type?: string;
  vr_room?: string;
  created_at: string;
  expires_at: string;
  ended_at?: string;
}

export interface SessionInfo {
  session: CompanionSession;
  participants: SessionUser[];
  host: SessionUser;
}

export interface VRState {
  session_id: string;
  user_id: string;
  avatar_position?: { x: number; y: number; z: number };
  avatar_rotation?: { x: number; y: number; z: number };
  head_position?: { x: number; y: number; z: number };
  left_hand_pos?: { x: number; y: number; z: number };
  right_hand_pos?: { x: number; y: number; z: number };
  current_activity?: string;
  current_room?: string;
  haptic_device_connected: boolean;
  haptic_device_name?: string;
  haptic_intensity?: number;
}

export interface JoinSessionRequest {
  session_code: string;
  display_name?: string;
  device_type: DeviceType;
}

export interface SetHapticPermissionRequest {
  controller_id: string;
  permission_type: 'always' | 'request' | 'never';
  max_intensity?: number;
}

export interface SessionHapticRequest {
  to_user_id: string;
  command_type: 'vibrate' | 'pattern' | 'stop';
  intensity?: number;
  duration_ms?: number;
  pattern_name?: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Join a session by code (companion)
 */
export async function joinSession(req: JoinSessionRequest) {
  return apiClient.post<SessionInfo>('/v1/sessions/join', req);
}

/**
 * Get session details
 */
export async function getSession(sessionId: string) {
  return apiClient.get<SessionInfo>(`/v1/sessions/${sessionId}`);
}

/**
 * Leave a session
 */
export async function leaveSession(sessionId: string) {
  return apiClient.post(`/v1/sessions/${sessionId}/leave`, {});
}

/**
 * Set haptic permission for a user
 */
export async function setHapticPermission(sessionId: string, req: SetHapticPermissionRequest) {
  return apiClient.post(`/v1/sessions/${sessionId}/haptic-permission`, req);
}

/**
 * Send a chat message in session
 */
export async function sendSessionChat(sessionId: string, content: string) {
  return apiClient.post(`/v1/sessions/${sessionId}/chat`, { content });
}

/**
 * Send a haptic command to another user in session
 */
export async function sendSessionHaptic(sessionId: string, req: SessionHapticRequest) {
  return apiClient.post(`/v1/sessions/${sessionId}/haptic`, req);
}

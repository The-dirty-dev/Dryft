import apiClient from './api';

// =============================================================================
// Types
// =============================================================================

export interface HapticDevice {
  id: string;
  user_id: string;
  device_index: number;
  device_name: string;
  device_address?: string;
  can_vibrate: boolean;
  can_rotate: boolean;
  can_linear: boolean;
  can_battery: boolean;
  vibrate_count: number;
  rotate_count: number;
  linear_count: number;
  display_name?: string;
  is_primary: boolean;
  max_intensity: number;
  last_connected?: string;
  created_at: string;
  updated_at: string;
}

export interface HapticDevicePublic {
  id: string;
  device_name: string;
  display_name?: string;
  can_vibrate: boolean;
  can_rotate: boolean;
  can_linear: boolean;
  is_primary: boolean;
}

export type PermissionType = 'always' | 'request' | 'never';

export interface HapticPermission {
  id: string;
  owner_id: string;
  controller_id: string;
  match_id: string;
  permission_type: PermissionType;
  max_intensity: number;
  expires_at?: string;
  granted_at: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
}

export type HapticCommandType = 'vibrate' | 'rotate' | 'linear' | 'stop' | 'pattern';

export interface HapticCommand {
  target_user_id: string;
  match_id: string;
  device_id?: string;
  command_type: HapticCommandType;
  intensity: number;
  duration_ms: number;
  motor_index?: number;
  pattern_id?: string;
}

export interface PatternStep {
  time_ms: number;
  intensity: number;
  motor_index: number;
}

export interface HapticPattern {
  id: string;
  creator_id?: string;
  store_item_id?: string;
  name: string;
  description?: string;
  is_public: boolean;
  pattern_data: PatternStep[];
  duration_ms: number;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface RegisterDeviceRequest {
  device_index: number;
  device_name: string;
  device_address?: string;
  can_vibrate: boolean;
  can_rotate: boolean;
  can_linear: boolean;
  can_battery: boolean;
  vibrate_count: number;
  rotate_count: number;
  linear_count: number;
}

export interface UpdateDeviceRequest {
  display_name?: string;
  is_primary?: boolean;
  max_intensity?: number;
}

export interface SetPermissionRequest {
  controller_id: string;
  match_id: string;
  permission_type: PermissionType;
  max_intensity?: number;
  duration_mins?: number;
}

// =============================================================================
// API Functions
// =============================================================================

// Device management
export async function registerDevice(device: RegisterDeviceRequest) {
  return apiClient.post<HapticDevice>('/v1/haptic/devices', device);
}

export async function getDevices() {
  return apiClient.get<{ devices: HapticDevice[] }>('/v1/haptic/devices');
}

export async function getDevice(deviceId: string) {
  return apiClient.get<HapticDevice>(`/v1/haptic/devices/${deviceId}`);
}

export async function updateDevice(deviceId: string, updates: UpdateDeviceRequest) {
  return apiClient.patch<HapticDevice>(`/v1/haptic/devices/${deviceId}`, updates);
}

export async function deleteDevice(deviceId: string) {
  return apiClient.delete(`/v1/haptic/devices/${deviceId}`);
}

// Permission management
export async function setPermission(request: SetPermissionRequest) {
  return apiClient.post<HapticPermission>('/v1/haptic/permissions', request);
}

export async function getMatchPermissions(matchId: string) {
  return apiClient.get<{ permissions: HapticPermission[] }>(`/v1/haptic/permissions/match/${matchId}`);
}

export async function revokePermission(controllerId: string, matchId: string) {
  return apiClient.delete('/v1/haptic/permissions');
}

// Commands
export async function sendHapticCommand(command: HapticCommand) {
  return apiClient.post<{ status: string }>('/v1/haptic/command', command);
}

// Patterns
export async function getPatterns() {
  return apiClient.get<{ patterns: HapticPattern[] }>('/v1/haptic/patterns');
}

export async function getPattern(patternId: string) {
  return apiClient.get<HapticPattern>(`/v1/haptic/patterns/${patternId}`);
}

// Match devices (view other user's devices)
export async function getMatchDevices(matchId: string) {
  return apiClient.get<{ devices: HapticDevicePublic[] }>(`/v1/haptic/match/${matchId}/devices`);
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerDevice,
  sendHapticCommand,
  getDevices,
  updateDevice,
  deleteDevice,
} from '@/lib/hapticApi';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('hapticApi', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    mockApiClient.patch.mockReset();
    mockApiClient.delete.mockReset();
  });

  it('registers a device with expected payload', async () => {
    const payload = {
      device_index: 0,
      device_name: 'Intiface Device',
      can_vibrate: true,
      can_rotate: false,
      can_linear: false,
      can_battery: false,
      vibrate_count: 2,
      rotate_count: 0,
      linear_count: 0,
    };

    await registerDevice(payload);

    expect(mockApiClient.post).toHaveBeenCalledWith('/v1/haptic/devices', payload);
  });

  it('sends haptic commands and device updates through api client', async () => {
    await sendHapticCommand({
      target_user_id: 'user-1',
      match_id: 'match-1',
      command_type: 'vibrate',
      intensity: 0.8,
      duration_ms: 500,
    });

    await updateDevice('device-1', { max_intensity: 0.7 });

    expect(mockApiClient.post).toHaveBeenCalledWith('/v1/haptic/command', expect.any(Object));
    expect(mockApiClient.patch).toHaveBeenCalledWith('/v1/haptic/devices/device-1', { max_intensity: 0.7 });
  });

  it('fetches and deletes devices using expected endpoints', async () => {
    await getDevices();
    await deleteDevice('device-2');

    expect(mockApiClient.get).toHaveBeenCalledWith('/v1/haptic/devices');
    expect(mockApiClient.delete).toHaveBeenCalledWith('/v1/haptic/devices/device-2');
  });
});

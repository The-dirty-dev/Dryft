import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useHaptic } from './useHaptic';

const mockIntiface = vi.hoisted(() => ({
  setCallbacks: vi.fn(),
  isConnected: false,
  getDevices: vi.fn(() => []),
  connect: vi.fn(),
  disconnect: vi.fn(),
  startScanning: vi.fn(),
  stopScanning: vi.fn(),
  vibrate: vi.fn(),
  rotate: vi.fn(),
  linear: vi.fn(),
  stopDevice: vi.fn(),
  stopAllDevices: vi.fn(),
  getBatteryLevel: vi.fn(),
}));

const mockHapticApi = vi.hoisted(() => ({
  getDevices: vi.fn(),
  registerDevice: vi.fn(),
  updateDevice: vi.fn(),
  deleteDevice: vi.fn(),
}));

vi.mock('@/lib/intiface', () => ({
  __esModule: true,
  default: mockIntiface,
}));

vi.mock('@/lib/hapticApi', () => ({
  __esModule: true,
  ...mockHapticApi,
}));

describe('useHaptic', () => {
  beforeEach(() => {
    mockIntiface.isConnected = false;
    mockIntiface.connect.mockReset();
    mockIntiface.startScanning.mockReset();
    mockHapticApi.getDevices.mockReset();
  });

  it('connects to Intiface and updates connection state', async () => {
    mockIntiface.connect.mockResolvedValue(true);
    mockHapticApi.getDevices.mockResolvedValue({ success: true, data: { devices: [] } });

    const { result } = renderHook(() => useHaptic());

    let connected = false;
    await act(async () => {
      connected = await result.current.connect();
    });

    expect(connected).toBe(true);
    expect(result.current.isConnected).toBe(true);
  });

  it('sets error when scanning without connection', async () => {
    mockHapticApi.getDevices.mockResolvedValue({ success: true, data: { devices: [] } });
    const { result } = renderHook(() => useHaptic());

    await act(async () => {
      await result.current.startScanning();
    });

    expect(result.current.connectionError).toBe('Not connected to Intiface Central');
  });
});

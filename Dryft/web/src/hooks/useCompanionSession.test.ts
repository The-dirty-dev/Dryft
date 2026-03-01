import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useCompanionSession } from './useCompanionSession';

const mockSessionApi = vi.hoisted(() => ({
  joinSession: vi.fn(),
  leaveSession: vi.fn(),
  sendSessionChat: vi.fn(),
  sendSessionHaptic: vi.fn(),
  setHapticPermission: vi.fn(),
}));

vi.mock('@/lib/sessionApi', () => ({
  __esModule: true,
  ...mockSessionApi,
}));

vi.mock('./useHaptic', () => ({
  useHaptic: () => ({
    vibrate: vi.fn(),
    stopAllDevices: vi.fn(),
    isConnected: false,
  }),
}));

describe('useCompanionSession', () => {
  beforeEach(() => {
    mockSessionApi.joinSession.mockReset();
    mockSessionApi.leaveSession.mockReset();
    localStorage.removeItem('dryft_token');
  });

  it('joins a session and updates state', async () => {
    mockSessionApi.joinSession.mockResolvedValue({
      success: true,
      data: {
        session: { id: 'session-1' },
        participants: [],
        host: { user_id: 'host-1' },
      },
    });

    const { result } = renderHook(() => useCompanionSession());

    let success = false;
    await act(async () => {
      success = await result.current.joinSession('ABCD12', 'Alex');
    });

    expect(success).toBe(true);
    expect(result.current.session?.session.id).toBe('session-1');
    expect(result.current.isJoining).toBe(false);
  });

  it('leaves a session and clears state', async () => {
    mockSessionApi.joinSession.mockResolvedValue({
      success: true,
      data: {
        session: { id: 'session-2' },
        participants: [],
        host: { user_id: 'host-2' },
      },
    });
    mockSessionApi.leaveSession.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCompanionSession());

    await act(async () => {
      await result.current.joinSession('EFGH34', 'Jordan');
    });

    await act(async () => {
      await result.current.leaveSession();
    });

    expect(result.current.session).toBeNull();
    expect(result.current.chatMessages).toHaveLength(0);
  });
});

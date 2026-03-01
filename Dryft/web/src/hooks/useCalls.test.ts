import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useCalls } from './useCalls';
import { useAuthStore } from '@/store/authStore';

let handlers: Record<string, any> = {};

const mockCallSignalingService = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  setHandlers: vi.fn((next: any) => {
    handlers = { ...handlers, ...next };
  }),
  initiateCall: vi.fn(),
  rejectCall: vi.fn(),
  endCall: vi.fn(),
  isConnectedToSignaling: vi.fn(() => true),
}));

vi.mock('@/lib/callSignaling', () => ({
  __esModule: true,
  callSignalingService: mockCallSignalingService,
}));

vi.mock('uuid', () => ({
  v4: () => 'call-1',
}));

describe('useCalls', () => {
  beforeEach(() => {
    handlers = {};
    mockCallSignalingService.connect.mockClear();
    mockCallSignalingService.initiateCall.mockClear();
    useAuthStore.setState(
      {
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        user: null,
      },
      false
    );
  });

  it('handles incoming call and accepts it', async () => {
    useAuthStore.setState(
      {
        token: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
        user: null,
      },
      false
    );

    const { result } = renderHook(() => useCalls());

    await waitFor(() => {
      expect(mockCallSignalingService.connect).toHaveBeenCalled();
    });

    act(() => {
      handlers.onIncomingCall?.({
        callId: 'call-123',
        callerId: 'user-1',
        callerName: 'Jamie',
        videoEnabled: true,
        matchId: 'match-1',
      });
    });

    expect(result.current.incomingCall?.callerName).toBe('Jamie');

    act(() => {
      result.current.acceptIncomingCall();
    });

    expect(result.current.incomingCall).toBeNull();
    expect(result.current.activeCall?.callId).toBe('call-123');
    expect(result.current.activeCall?.isIncoming).toBe(true);
  });

  it('initiates a call and sets active state', () => {
    const { result } = renderHook(() => useCalls());

    act(() => {
      result.current.initiateCall({
        matchId: 'match-2',
        userId: 'user-2',
        userName: 'Alex',
        videoEnabled: false,
      });
    });

    expect(result.current.activeCall?.callId).toBe('call-1');
    expect(result.current.activeCall?.isIncoming).toBe(false);
  });
});

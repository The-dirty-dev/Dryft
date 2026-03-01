import { renderHook, act } from '@testing-library/react-hooks';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockSetHandlers = jest.fn();
const mockInitiateCall = jest.fn();
const mockDisconnect = jest.fn();
const mockIsConnected = jest.fn().mockReturnValue(true);

jest.mock('../../services/callSignaling', () => ({
  callSignalingService: {
    connect: mockConnect,
    setHandlers: mockSetHandlers,
    initiateCall: mockInitiateCall,
    disconnect: mockDisconnect,
    isConnectedToSignaling: mockIsConnected,
  },
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}));

jest.mock('uuid', () => ({
  v4: () => 'call-123',
}));

// Late require to ensure mocks are registered first
const { useCalls } = require('../../hooks/useCalls') as any;

describe('useCalls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__mockNavigation.navigate = jest.fn();
  });

  it('connects to signaling when authenticated', async () => {
    renderHook(() => useCalls());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockConnect).toHaveBeenCalled();
    expect(mockSetHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        onIncomingCall: expect.any(Function),
        onCallBusy: expect.any(Function),
      })
    );
  });

  it('initiates a call and navigates to the video screen', async () => {
    const { result } = renderHook(() => useCalls());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.initiateCall('match-1', 'user-2', 'Jordan', true);
    });

    expect((global as any).__mockNavigation.navigate).toHaveBeenCalledWith(
      'VideoCall',
      expect.objectContaining({
        matchId: 'match-1',
        userId: 'user-2',
        userName: 'Jordan',
        isIncoming: false,
        videoEnabled: true,
        callId: 'call-123',
      })
    );
    expect(mockInitiateCall).toHaveBeenCalledWith('call-123', 'user-2', 'match-1', true);
  });
});

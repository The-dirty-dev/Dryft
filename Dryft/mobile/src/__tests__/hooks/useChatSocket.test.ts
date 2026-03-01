import { renderHook, act } from '@testing-library/react-hooks';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn();
const mockSetHandlers = jest.fn();
const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
const mockSendMessage = jest.fn();
const mockStartTyping = jest.fn();
const mockStopTyping = jest.fn();
const mockMarkRead = jest.fn();

let handlers: any = {};

jest.mock('../../services/chatSocket', () => ({
  __esModule: true,
  default: {
    connect: mockConnect,
    disconnect: mockDisconnect,
    setHandlers: (next: any) => {
      handlers = next;
      mockSetHandlers(next);
    },
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    sendMessage: mockSendMessage,
    startTyping: mockStartTyping,
    stopTyping: mockStopTyping,
    markRead: mockMarkRead,
  },
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}));

// Late require to ensure mocks are registered first
const { useChatSocket } = require('../../hooks/useChatSocket') as any;

describe('useChatSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
  });

  it('connects and updates connection state', async () => {
    const { result } = renderHook(() => useChatSocket());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetHandlers).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalled();

    act(() => {
      handlers.onConnected?.();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('exposes chat actions', () => {
    const { result } = renderHook(() => useChatSocket());

    result.current.subscribe('conv-1');
    result.current.unsubscribe('conv-1');
    result.current.sendMessage('conv-1', 'Hi');
    result.current.startTyping('conv-1');
    result.current.stopTyping('conv-1');
    result.current.markRead('conv-1');

    expect(mockSubscribe).toHaveBeenCalledWith('conv-1');
    expect(mockUnsubscribe).toHaveBeenCalledWith('conv-1');
    expect(mockSendMessage).toHaveBeenCalledWith('conv-1', 'Hi', 'text');
    expect(mockStartTyping).toHaveBeenCalledWith('conv-1');
    expect(mockStopTyping).toHaveBeenCalledWith('conv-1');
    expect(mockMarkRead).toHaveBeenCalledWith('conv-1');
  });
});

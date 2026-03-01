import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useChatSocket } from './useChatSocket';
import { useAuthStore } from '@/store/authStore';

let handlers: Record<string, any> = {};

const mockChatSocketService = vi.hoisted(() => ({
  setTokenGetter: vi.fn(),
  setHandlers: vi.fn((next: any) => {
    handlers = { ...handlers, ...next };
  }),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue(true),
  startTyping: vi.fn(),
  stopTyping: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock('@/lib/chatSocket', () => ({
  __esModule: true,
  default: mockChatSocketService,
}));

describe('useChatSocket', () => {
  beforeEach(() => {
    handlers = {};
    mockChatSocketService.setHandlers.mockClear();
    mockChatSocketService.connect.mockClear();
    mockChatSocketService.subscribe.mockClear();
    mockChatSocketService.sendMessage.mockClear();
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

  it('connects when authenticated and updates connection state', async () => {
    useAuthStore.setState(
      {
        token: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
        user: null,
      },
      false
    );

    const { result } = renderHook(() => useChatSocket());

    await waitFor(() => {
      expect(mockChatSocketService.connect).toHaveBeenCalled();
    });

    act(() => {
      handlers.onConnected?.();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('subscribes and sends messages through the socket service', async () => {
    useAuthStore.setState(
      {
        token: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
        user: null,
      },
      false
    );

    const { result } = renderHook(() => useChatSocket());

    act(() => {
      result.current.subscribe('conv-1');
    });

    expect(mockChatSocketService.subscribe).toHaveBeenCalledWith('conv-1');

    await act(async () => {
      await result.current.sendMessage('conv-1', 'Hello');
    });

    expect(mockChatSocketService.sendMessage).toHaveBeenCalledWith('conv-1', 'Hello', 'text');
  });
});

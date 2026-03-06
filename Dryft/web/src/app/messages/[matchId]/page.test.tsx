import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPage from '@/app/messages/[matchId]/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

const mockSocketSend = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

vi.mock('@/hooks/useChatSocket', () => ({
  useChatSocket: () => ({
    isConnected: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    sendMessage: mockSocketSend,
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    markRead: vi.fn(),
  }),
}));

describe('messages/[matchId] page', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    (globalThis as any).__mockParams = { matchId: 'match-1' };
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));

    mockApiClient.get.mockImplementation((url: string) => {
      if (url === '/v1/matches/match-1') {
        return Promise.resolve({
          success: true,
          data: {
            id: 'match-1',
            user: { id: 'user-2', display_name: 'Jamie', profile_photo: null },
            matched_at: new Date().toISOString(),
          },
        });
      }
      if (url === '/v1/matches/match-1/conversation') {
        return Promise.resolve({ success: true, data: { id: 'conv-1' } });
      }
      if (url === '/v1/conversations/conv-1/messages') {
        return Promise.resolve({
          success: true,
          data: {
            messages: [
              {
                id: 'msg-1',
                conversation_id: 'conv-1',
                sender_id: 'user-2',
                content: 'hello there',
                content_type: 'text',
                created_at: new Date().toISOString(),
              },
            ],
          },
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    mockApiClient.post.mockResolvedValue({
      success: true,
      data: {
        id: 'msg-new',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        content: 'hi!',
        content_type: 'text',
        created_at: new Date().toISOString(),
      },
    });
  });

  it('renders message history for selected match', async () => {
    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText('Jamie')).toBeInTheDocument();
      expect(screen.getByText('hello there')).toBeInTheDocument();
    });
  });

  it('sends message via REST when websocket is disconnected', async () => {
    render(<ChatPage />);

    await screen.findByText('Jamie');

    fireEvent.change(screen.getByPlaceholderText('Type a message...'), {
      target: { value: 'hi!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/v1/conversations/conv-1/messages', {
        content: 'hi!',
        type: 'text',
      });
    });
  });

  it('renders loading spinner while data is loading', async () => {
    mockApiClient.get.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: {} }), 50))
    );

    render(<ChatPage />);

    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });
});

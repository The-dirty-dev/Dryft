import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MessagesPage from '@/app/messages/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

vi.mock('@/hooks/useChatSocket', () => ({
  useChatSocket: () => ({ isConnected: true }),
}));

describe('MessagesPage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
  });

  it('filters conversations based on search query', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        matches: [
          {
            id: 'match-1',
            user: { id: 'user-1', display_name: 'Alice' },
            matched_at: new Date().toISOString(),
            last_message: 'Hi there',
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          },
          {
            id: 'match-2',
            user: { id: 'user-2', display_name: 'Cara' },
            matched_at: new Date().toISOString(),
            last_message: 'Hello',
            last_message_at: new Date().toISOString(),
            unread_count: 0,
          },
        ],
      },
    });

    render(<MessagesPage />);

    await screen.findByText('Alice');
    await screen.findByText('Cara');

    fireEvent.change(screen.getByPlaceholderText('Search conversations...'), {
      target: { value: 'Ali' },
    });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('Cara')).toBeNull();
    });
  });
});

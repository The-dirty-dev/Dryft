import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import GlobalNotifications from '@/components/GlobalNotifications';
import { API_ERROR_EVENT } from '@/lib/api';

const showToast = vi.hoisted(() => vi.fn());
const showMatchNotification = vi.hoisted(() => vi.fn());

let onNewMatchCallback:
  | ((payload: { match_id: string; user: { display_name: string; photo_url?: string } }) => void)
  | undefined;
let initCallback: ((payload: { data?: { type: string; match_id?: string } }) => void) | undefined;

vi.mock('@/components/Toast', () => ({
  useToast: () => ({
    showToast,
    showMatchNotification,
  }),
}));

vi.mock('@/hooks/useChatSocket', () => ({
  useChatSocket: (handlers: { onNewMatch?: typeof onNewMatchCallback }) => {
    onNewMatchCallback = handlers.onNewMatch;
  },
}));

vi.mock('@/lib/notifications', () => ({
  __esModule: true,
  default: {
    initialize: vi.fn(async (callback: typeof initCallback) => {
      initCallback = callback;
    }),
  },
}));

describe('GlobalNotifications', () => {
  beforeEach(() => {
    showToast.mockReset();
    showMatchNotification.mockReset();
    onNewMatchCallback = undefined;
    initCallback = undefined;
    localStorage.clear();
  });

  it('initializes push notifications when auth token is present', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'token-123' } }));

    render(<GlobalNotifications />);

    await waitFor(() => {
      expect(initCallback).toBeDefined();
    });
  });

  it('shows a toast when an API error event is dispatched', async () => {
    render(<GlobalNotifications />);

    window.dispatchEvent(
      new CustomEvent(API_ERROR_EVENT, {
        detail: { message: 'Something broke' },
      })
    );

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'Something broke',
        })
      );
    });
  });

  it('shows a match notification on realtime match events', () => {
    render(<GlobalNotifications />);

    onNewMatchCallback?.({
      match_id: 'match-1',
      user: {
        display_name: 'Taylor',
        photo_url: 'photo.jpg',
      },
    });

    expect(showMatchNotification).toHaveBeenCalledWith(
      'Taylor',
      'photo.jpg',
      expect.any(Function)
    );
  });
});

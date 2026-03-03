import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalNotifications from '@/components/GlobalNotifications';
import { API_ERROR_EVENT } from '@/lib/api';

const showToast = vi.hoisted(() => vi.fn());
const showMatchNotification = vi.hoisted(() => vi.fn());

let onNewMatchCallback:
  | ((payload: { match_id: string; user: { display_name: string; photo_url?: string } }) => void)
  | undefined;
let initCallback:
  | ((payload: { title: string; body: string; data?: { type?: string; match_id?: string; caller_name?: string; call_id?: string } }) => void)
  | undefined;

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
  let serviceWorkerMessageHandler: ((event: MessageEvent) => void) | null = null;

  beforeEach(() => {
    showToast.mockReset();
    showMatchNotification.mockReset();
    onNewMatchCallback = undefined;
    initCallback = undefined;
    localStorage.clear();

    const addEventListener = vi.fn((event: string, cb: (event: MessageEvent) => void) => {
      if (event === 'message') {
        serviceWorkerMessageHandler = cb;
      }
    });
    const removeEventListener = vi.fn((event: string) => {
      if (event === 'message') {
        serviceWorkerMessageHandler = null;
      }
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener,
        removeEventListener,
      },
    });

    const router = (globalThis as any).__mockRouter;
    router.push.mockReset();
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

    expect(showMatchNotification).toHaveBeenCalledWith('Taylor', 'photo.jpg', expect.any(Function));
  });

  it('handles foreground notification types with toast actions', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'token-123' } }));
    render(<GlobalNotifications />);

    await waitFor(() => {
      expect(initCallback).toBeDefined();
    });

    initCallback?.({ title: 'New message', body: 'hi', data: { type: 'new_message', match_id: 'm-1' } });
    initCallback?.({ title: 'Incoming call', body: 'ring', data: { type: 'incoming_call', caller_name: 'Alex', call_id: 'call-1' } });
    initCallback?.({ title: 'Like', body: 'someone likes you', data: { type: 'new_like' } });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        message: 'New message received',
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Alex is calling...',
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        message: 'Someone likes you!',
      })
    );
  });

  it('navigates when service worker sends notification click event', () => {
    render(<GlobalNotifications />);

    serviceWorkerMessageHandler?.({
      data: { type: 'notification_click', targetUrl: '/messages/abc' },
    } as MessageEvent);

    const router = (globalThis as any).__mockRouter;
    expect(router.push).toHaveBeenCalledWith('/messages/abc');
  });
});

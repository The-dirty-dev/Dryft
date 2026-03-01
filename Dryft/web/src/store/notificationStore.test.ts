import { vi } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  apiClient: mockApiClient,
  default: mockApiClient,
}));

let useNotificationStore: (typeof import('./notificationStore'))['useNotificationStore'];

const resetState = () =>
  useNotificationStore.setState(
    {
      notifications: [],
      isLoadingNotifications: false,
      notificationsError: null,
      unreadCount: 0,
    },
    false
  );

describe('notificationStore', () => {
  beforeAll(async () => {
    ({ useNotificationStore } = await import('./notificationStore'));
  });

  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    resetState();
  });

  it('loads notifications and unread count', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        notifications: [
          {
            id: 'notif-1',
            type: 'new_match',
            title: 'Match',
            body: 'You matched!',
            read: false,
            created_at: new Date().toISOString(),
          },
        ],
        unread_count: 1,
      },
    });

    await useNotificationStore.getState().loadNotifications();

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it('marks notification as read and updates unread count', async () => {
    mockApiClient.post.mockResolvedValue({ success: true });
    useNotificationStore.setState(
      {
        ...useNotificationStore.getState(),
        notifications: [
          {
            id: 'notif-2',
            type: 'new_message',
            title: 'Message',
            body: 'Hello',
            read: false,
            created_at: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
      false
    );

    await useNotificationStore.getState().markAsRead('notif-2');

    const state = useNotificationStore.getState();
    expect(state.notifications[0].read).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it('adds notification and increments unread count', () => {
    useNotificationStore.getState().addNotification({
      id: 'notif-3',
      type: 'system',
      title: 'Notice',
      body: 'System update',
      read: false,
      created_at: new Date().toISOString(),
    });

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });
});

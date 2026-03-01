import { renderHook, act } from '@testing-library/react-hooks';

const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockGetNotifications = jest.fn();
const mockSubscribe = jest.fn();
const mockFetchFromServer = jest.fn().mockResolvedValue(undefined);
const mockGetGroupedNotifications = jest.fn();

jest.mock('../../services/notificationCenter', () => ({
  notificationCenterService: {
    initialize: mockInitialize,
    getNotifications: mockGetNotifications,
    subscribe: mockSubscribe,
    fetchFromServer: mockFetchFromServer,
    getGroupedNotifications: mockGetGroupedNotifications,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsActioned: jest.fn(),
    deleteNotification: jest.fn(),
    clearAll: jest.fn(),
  },
}));

// Late require to ensure mocks are registered first
const { useNotifications } = require('../../hooks/useNotificationCenter') as any;

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribe.mockReturnValue(jest.fn());
    mockGetNotifications.mockReturnValue([
      { id: 'n1', isRead: false },
      { id: 'n2', isRead: true },
    ]);
    mockGetGroupedNotifications.mockReturnValue([]);
  });

  it('loads notifications and computes unread count', async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  it('refreshes from the server', async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetchFromServer).toHaveBeenCalled();
  });
});

import notificationCenterService from '../../services/notificationCenter';

jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn(),
  },
}), { virtual: true });

jest.mock('../../services/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('notificationCenterService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await notificationCenterService.clearAll();
  });

  it('merges server notifications with local ones', async () => {
    const { api } = jest.requireMock('../../services/api');
    api.get.mockResolvedValue({
      data: {
        notifications: [
          {
            id: 'server-1',
            type: 'system',
            title: 'Server',
            body: 'From server',
            priority: 'normal',
            isRead: false,
            isActioned: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    await notificationCenterService.addNotification({
      type: 'promotion',
      title: 'Local',
      body: 'Local notice',
      priority: 'low',
    });

    await notificationCenterService.fetchFromServer();

    const notifications = notificationCenterService.getNotifications();

    expect(api.get).toHaveBeenCalledWith('/v1/notifications');
    expect(notifications.length).toBe(2);
  });
});

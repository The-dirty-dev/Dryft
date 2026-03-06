import * as notificationCenterHooks from '../../hooks/useNotificationCenter';

describe('useNotificationCenter hooks', () => {
  it('exports useNotifications', () => {
    expect(typeof notificationCenterHooks.useNotifications).toBe('function');
  });

  it('exports useUnreadCount', () => {
    expect(typeof notificationCenterHooks.useUnreadCount).toBe('function');
  });

  it('exports useNotificationPreferences', () => {
    expect(typeof notificationCenterHooks.useNotificationPreferences).toBe('function');
  });
});

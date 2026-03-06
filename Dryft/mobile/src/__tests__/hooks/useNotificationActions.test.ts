import * as notificationActionHooks from '../../hooks/useNotificationActions';

describe('useNotificationActions hooks', () => {
  it('exports useNotificationActions', () => {
    expect(typeof notificationActionHooks.useNotificationActions).toBe('function');
  });

  it('exports useNotificationSetup', () => {
    expect(typeof notificationActionHooks.useNotificationSetup).toBe('function');
  });

  it('exports useNotificationBadge', () => {
    expect(typeof notificationActionHooks.useNotificationBadge).toBe('function');
  });
});

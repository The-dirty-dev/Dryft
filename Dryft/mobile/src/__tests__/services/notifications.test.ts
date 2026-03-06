import notificationService, { notificationService as namedNotificationService } from '../../services/notifications';

describe('services/notifications', () => {
  it('exports notification service singleton', () => {
    expect(notificationService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(notificationService).toBe(namedNotificationService);
  });

  it('exposes registerDeviceToken API', () => {
    expect(typeof (notificationService as any).registerForPushNotifications).toBe('function');
  });
});

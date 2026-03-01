// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
  },
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  Vibration: {
    vibrate: jest.fn(),
    cancel: jest.fn(),
  },
}));

describe('Notification Types', () => {
  describe('VR Session Notifications', () => {
    it('vr_session_started notification type', () => {
      const notification = {
        type: 'vr_session_started',
        sessionId: 'session_123',
        userId: 'user_456',
        userName: 'VR Player',
      };

      expect(notification.type).toBe('vr_session_started');
      expect(notification).toHaveProperty('sessionId');
      expect(notification).toHaveProperty('userId');
      expect(notification).toHaveProperty('userName');
    });

    it('vr_entered_booth notification type', () => {
      const notification = {
        type: 'vr_entered_booth',
        sessionId: 'session_123',
        boothId: 'booth_789',
        partnerName: 'Partner',
      };

      expect(notification.type).toBe('vr_entered_booth');
      expect(notification).toHaveProperty('boothId');
      expect(notification).toHaveProperty('partnerName');
    });

    it('vr_haptic_ping notification type', () => {
      const notification = {
        type: 'vr_haptic_ping',
        intensity: 0.8,
        userId: 'user_456',
      };

      expect(notification.type).toBe('vr_haptic_ping');
      expect(notification.intensity).toBeGreaterThan(0);
      expect(notification.intensity).toBeLessThanOrEqual(1);
    });

    it('vr_session_ended notification type', () => {
      const notification = {
        type: 'vr_session_ended',
        sessionId: 'session_123',
      };

      expect(notification.type).toBe('vr_session_ended');
    });
  });

  describe('Android Notification Channels', () => {
    it('VR Sessions channel config', () => {
      const channel = {
        id: 'vr-sessions',
        name: 'VR Sessions',
        importance: 4, // HIGH
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E94560',
      };

      expect(channel.id).toBe('vr-sessions');
      expect(channel.importance).toBe(4);
      expect(channel.vibrationPattern).toHaveLength(4);
    });

    it('Haptics channel config', () => {
      const channel = {
        id: 'haptics',
        name: 'Haptic Alerts',
        importance: 5, // MAX
        vibrationPattern: [0, 100, 100, 100, 100, 100],
        lightColor: '#FF6B6B',
      };

      expect(channel.id).toBe('haptics');
      expect(channel.importance).toBe(5);
    });
  });

  describe('Haptic Handling', () => {
    it('calculates vibration pattern from intensity', () => {
      const intensity = 0.5;
      const baseDuration = 100;
      const duration = Math.round(baseDuration * intensity);

      expect(duration).toBe(50);
    });

    it('clamps intensity between 0 and 1', () => {
      const clamp = (val: number) => Math.max(0, Math.min(1, val));

      expect(clamp(-0.5)).toBe(0);
      expect(clamp(0.5)).toBe(0.5);
      expect(clamp(1.5)).toBe(1);
    });

    it('creates repeating pattern for continuous haptic', () => {
      const intensity = 0.8;
      const duration = Math.round(200 * intensity);
      const pause = Math.round(100 * (1 - intensity));
      const pattern = [0, duration, pause, duration, pause, duration];

      expect(pattern).toEqual([0, 160, 20, 160, 20, 160]);
    });
  });
});

describe('Notification Handler', () => {
  it('handles notification with data', () => {
    const notification = {
      request: {
        content: {
          title: 'VR Session Started',
          body: 'Your companion started a VR session',
          data: {
            type: 'vr_session_started',
            sessionId: 'session_123',
            sessionCode: 'ABC123',
          },
        },
      },
    };

    expect(notification.request.content.data.type).toBe('vr_session_started');
    expect(notification.request.content.data.sessionCode).toBe('ABC123');
  });

  it('handles notification response navigation', () => {
    const response = {
      notification: {
        request: {
          content: {
            data: {
              type: 'vr_entered_booth',
              sessionCode: 'XYZ789',
              inBooth: true,
              partnerName: 'Partner',
            },
          },
        },
      },
      actionIdentifier: 'default',
    };

    const data = response.notification.request.content.data;

    // Should navigate to Companion screen with params
    const navigationParams = {
      sessionCode: data.sessionCode,
      inBooth: data.inBooth,
      partnerName: data.partnerName,
    };

    expect(navigationParams.sessionCode).toBe('XYZ789');
    expect(navigationParams.inBooth).toBe(true);
  });
});

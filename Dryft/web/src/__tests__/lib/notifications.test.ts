import { beforeEach, describe, expect, it, vi } from 'vitest';
import notificationService from '@/lib/notifications';

describe('notificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('registers push token with backend using auth token', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'jwt-123' } }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await notificationService.registerTokenWithBackend('push-token');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/notifications/devices'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-123' }),
      })
    );
  });

  it('skips backend registration when auth token is missing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await notificationService.registerTokenWithBackend('push-token');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports support and permission status in browser context', () => {
    (globalThis as any).Notification = { permission: 'granted' };
    expect(typeof notificationService.isSupported()).toBe('boolean');
    expect(notificationService.getPermissionStatus()).toBe('granted');
  });

  it('clears local notification state on unregister', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'jwt-123' } }));
    localStorage.setItem('dryft_device_id', 'web-device-1');

    (notificationService as any).token = 'token-value';
    (notificationService as any).initialized = true;

    await notificationService.unregister();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/notifications/devices/web-device-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(notificationService.getToken()).toBeNull();
    expect(notificationService.isInitialized()).toBe(false);
  });
});

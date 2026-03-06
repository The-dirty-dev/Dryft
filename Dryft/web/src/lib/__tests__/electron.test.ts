import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAppVersion,
  isElectron,
  onDeepLink,
  openExternal,
  showNotification,
} from '@/lib/electron';

describe('lib/electron', () => {
  beforeEach(() => {
    delete (window as any).drift;
    vi.restoreAllMocks();
  });

  it('gracefully falls back when Electron API is unavailable', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    expect(isElectron()).toBe(false);
    expect(await getAppVersion()).toBeNull();

    openExternal('https://dryft.site');
    expect(openSpy).toHaveBeenCalledWith('https://dryft.site', '_blank', 'noopener,noreferrer');
  });

  it('dispatches calls through Electron bridge when available', async () => {
    const deepLinkCb = vi.fn();
    const notify = vi.fn();

    (window as any).drift = {
      isElectron: true,
      platform: 'darwin',
      getVersion: vi.fn(async () => '1.2.3'),
      checkForUpdates: vi.fn(async () => null),
      installUpdate: vi.fn(async () => undefined),
      onUpdateAvailable: vi.fn(),
      onUpdateDownloaded: vi.fn(),
      minimizeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      closeWindow: vi.fn(),
      openExternal: vi.fn(),
      showNotification: notify,
      onDeepLink: vi.fn((cb: (url: string) => void) => cb('dryft://open')),
      onNavigate: vi.fn(),
      openIntifaceDownload: vi.fn(),
      openDeviceSettings: vi.fn(),
      setIntifaceStatus: vi.fn(),
      hapticNotification: vi.fn(),
    };

    expect(isElectron()).toBe(true);
    expect(await getAppVersion()).toBe('1.2.3');

    showNotification('Dryft', 'Connected');
    expect(notify).toHaveBeenCalledWith('Dryft', 'Connected');

    onDeepLink(deepLinkCb);
    expect(deepLinkCb).toHaveBeenCalledWith('dryft://open');
  });
});

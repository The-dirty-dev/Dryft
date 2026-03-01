import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useElectron, isElectron } from './useElectron';

describe('useElectron', () => {
  beforeEach(() => {
    delete (window as any).drift;
    (globalThis as any).__mockRouter.push.mockReset();
  });

  it('uses browser fallbacks when not in Electron', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => useElectron());

    expect(isElectron()).toBe(false);

    act(() => {
      result.current.openExternal('https://dryft.site');
    });

    expect(openSpy).toHaveBeenCalledWith('https://dryft.site', '_blank');

    openSpy.mockRestore();
  });

  it('uses Electron APIs when available', () => {
    const onNavigate = vi.fn();
    (window as any).drift = {
      isElectron: true,
      onNavigate: (cb: (path: string) => void) => {
        onNavigate.mockImplementation(cb);
      },
      openExternal: vi.fn(),
      showNotification: vi.fn(),
      openIntifaceDownload: vi.fn(),
      openDeviceSettings: vi.fn(),
    };

    const { result } = renderHook(() => useElectron());

    act(() => {
      result.current.openExternal('https://dryft.site');
      result.current.showNotification('Title', 'Body');
      result.current.openDeviceSettings();
    });

    expect((window as any).drift.openExternal).toHaveBeenCalledWith('https://dryft.site');
    expect((window as any).drift.showNotification).toHaveBeenCalledWith('Title', 'Body');
    expect((window as any).drift.openDeviceSettings).toHaveBeenCalled();
  });
});

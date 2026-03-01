'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Check if running in Electron desktop app
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).drift?.isElectron;
}

/**
 * Get Electron API if available
 */
export function getElectronApi(): typeof window.drift | null {
  if (isElectron()) {
    return (window as any).drift;
  }
  return null;
}

/**
 * React hook to integrate with Electron desktop features.
 * @returns Flags and helpers for opening URLs, notifications, and device settings.
 * @example
 * const { isElectron, openExternal } = useElectron();
 * if (isElectron) openExternal('https://dryft.site');
 * @remarks
 * WebSocket events handled: none.
 */
export function useElectron() {
  const router = useRouter();

  // Handle navigation from tray menu
  useEffect(() => {
    const electron = getElectronApi();
    if (!electron) return;

    electron.onNavigate((path: string) => {
      router.push(path);
    });
  }, [router]);

  // Open external URL
  const openExternal = useCallback((url: string) => {
    const electron = getElectronApi();
    if (electron) {
      electron.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }, []);

  // Show notification
  const showNotification = useCallback((title: string, body: string) => {
    const electron = getElectronApi();
    if (electron) {
      electron.showNotification(title, body);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }, []);

  // Open Intiface download page
  const openIntifaceDownload = useCallback(() => {
    const electron = getElectronApi();
    if (electron) {
      electron.openIntifaceDownload();
    } else {
      window.open('https://intiface.com/central/', '_blank');
    }
  }, []);

  // Open device settings
  const openDeviceSettings = useCallback(() => {
    const electron = getElectronApi();
    if (electron) {
      electron.openDeviceSettings();
    } else {
      router.push('/settings/devices');
    }
  }, [router]);

  return {
    isElectron: isElectron(),
    openExternal,
    showNotification,
    openIntifaceDownload,
    openDeviceSettings,
  };
}

export default useElectron;

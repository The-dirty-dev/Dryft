/**
 * Electron integration helpers
 *
 * Detects if the app is running inside Electron and provides
 * access to native features when available.
 */

interface DryftElectronAPI {
  getVersion: () => Promise<string>;
  checkForUpdates: () => Promise<string | null>;
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  openExternal: (url: string) => void;
  showNotification: (title: string, body: string) => void;
  onDeepLink: (callback: (url: string) => void) => void;
  onNavigate: (callback: (path: string) => void) => void;
  openIntifaceDownload: () => void;
  openDeviceSettings: () => void;
  setIntifaceStatus: (connected: boolean) => void;
  hapticNotification: (event: string, data: string) => void;
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    drift?: DryftElectronAPI;
  }
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.drift?.isElectron;
}

/**
 * Get the current platform
 */
export function getPlatform(): string | null {
  if (!isElectron()) return null;
  return window.drift?.platform || null;
}

/**
 * Get the app version (Electron only)
 */
export async function getAppVersion(): Promise<string | null> {
  if (!isElectron()) return null;
  return window.drift?.getVersion() || null;
}

/**
 * Check for updates (Electron only)
 */
export async function checkForUpdates(): Promise<string | null> {
  if (!isElectron()) return null;
  return window.drift?.checkForUpdates() || null;
}

/**
 * Install available update (Electron only)
 */
export async function installUpdate(): Promise<void> {
  if (!isElectron()) return;
  return window.drift?.installUpdate();
}

/**
 * Listen for update available event
 */
export function onUpdateAvailable(callback: () => void): void {
  if (!isElectron()) return;
  window.drift?.onUpdateAvailable(callback);
}

/**
 * Listen for update downloaded event
 */
export function onUpdateDownloaded(callback: () => void): void {
  if (!isElectron()) return;
  window.drift?.onUpdateDownloaded(callback);
}

/**
 * Minimize the window (Electron only)
 */
export function minimizeWindow(): void {
  if (!isElectron()) return;
  window.drift?.minimizeWindow();
}

/**
 * Maximize/restore the window (Electron only)
 */
export function maximizeWindow(): void {
  if (!isElectron()) return;
  window.drift?.maximizeWindow();
}

/**
 * Close the window (Electron only)
 */
export function closeWindow(): void {
  if (!isElectron()) return;
  window.drift?.closeWindow();
}

/**
 * Open a URL in the default browser
 */
export function openExternal(url: string): void {
  if (isElectron()) {
    window.drift?.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Show a native notification
 */
export function showNotification(title: string, body: string): void {
  if (isElectron()) {
    window.drift?.showNotification(title, body);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

/**
 * Request notification permission (web only)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isElectron()) return true; // Always allowed in Electron

  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Listen for deep link events (Electron only)
 */
export function onDeepLink(callback: (url: string) => void): void {
  if (!isElectron()) return;
  window.drift?.onDeepLink(callback);
}

/**
 * Hook for using Electron features in React components
 */
export function useElectron() {
  return {
    isElectron: isElectron(),
    platform: getPlatform(),
    getAppVersion,
    checkForUpdates,
    installUpdate,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    openExternal,
    showNotification,
  };
}

import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-version'),

  // Updates
  checkForUpdates: (): Promise<string | null> => ipcRenderer.invoke('check-updates'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: () => void): void => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded', callback);
  },

  // Window controls
  minimizeWindow: (): void => ipcRenderer.send('minimize-window'),
  maximizeWindow: (): void => ipcRenderer.send('maximize-window'),
  closeWindow: (): void => ipcRenderer.send('close-window'),

  // External links
  openExternal: (url: string): void => ipcRenderer.send('open-external', url),

  // Notifications
  showNotification: (title: string, body: string): void => {
    ipcRenderer.send('show-notification', { title, body });
  },

  // Deep links
  onDeepLink: (callback: (url: string) => void): void => {
    ipcRenderer.on('deep-link', (_, url) => callback(url));
  },

  // Navigation (from tray menu)
  onNavigate: (callback: (path: string) => void): void => {
    ipcRenderer.on('navigate', (_, path) => callback(path));
  },

  // Platform info
  platform: process.platform,
  isElectron: true,

  // ==========================================================================
  // Haptic / Intiface APIs
  // ==========================================================================

  // Get default Intiface URL
  getIntifaceUrl: (): Promise<string> => ipcRenderer.invoke('get-intiface-url'),

  // Update Intiface connection status (for tray menu)
  setIntifaceStatus: (connected: boolean): void => {
    ipcRenderer.send('intiface-status', connected);
  },

  // Open Intiface download page
  openIntifaceDownload: (): void => {
    ipcRenderer.send('open-intiface-download');
  },

  // Show haptic device notification
  hapticNotification: (type: string, deviceName: string): void => {
    ipcRenderer.send('haptic-notification', { type, deviceName });
  },

  // Open device settings page
  openDeviceSettings: (): void => {
    ipcRenderer.send('open-device-settings');
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('drift', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.drift = api;
}

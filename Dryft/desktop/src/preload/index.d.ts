import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    drift: {
      // App info
      getVersion: () => Promise<string>;

      // Updates
      checkForUpdates: () => Promise<string | null>;
      installUpdate: () => Promise<void>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;

      // Window controls
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;

      // External links
      openExternal: (url: string) => void;

      // Notifications
      showNotification: (title: string, body: string) => void;

      // Deep links
      onDeepLink: (callback: (url: string) => void) => void;

      // Navigation (from tray menu)
      onNavigate: (callback: (path: string) => void) => void;

      // Platform info
      platform: NodeJS.Platform;
      isElectron: boolean;
      isDev: boolean;

      // Webview bootstrap — URL and preload path for the renderer shell
      appUrl: string;
      preloadPath: string;

      // Haptic / Intiface APIs
      getIntifaceUrl: () => Promise<string>;
      setIntifaceStatus: (connected: boolean) => void;
      openIntifaceDownload: () => void;
      hapticNotification: (type: string, deviceName: string) => void;
      openDeviceSettings: () => void;
    };
  }
}

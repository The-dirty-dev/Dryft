"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // App info
  getVersion: () => electron.ipcRenderer.invoke("get-version"),
  // Updates
  checkForUpdates: () => electron.ipcRenderer.invoke("check-updates"),
  installUpdate: () => electron.ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (callback) => {
    electron.ipcRenderer.on("update-available", callback);
  },
  onUpdateDownloaded: (callback) => {
    electron.ipcRenderer.on("update-downloaded", callback);
  },
  // Window controls
  minimizeWindow: () => electron.ipcRenderer.send("minimize-window"),
  maximizeWindow: () => electron.ipcRenderer.send("maximize-window"),
  closeWindow: () => electron.ipcRenderer.send("close-window"),
  // External links
  openExternal: (url) => electron.ipcRenderer.send("open-external", url),
  // Notifications
  showNotification: (title, body) => {
    electron.ipcRenderer.send("show-notification", { title, body });
  },
  // Deep links
  onDeepLink: (callback) => {
    electron.ipcRenderer.on("deep-link", (_, url) => callback(url));
  },
  // Navigation (from tray menu)
  onNavigate: (callback) => {
    electron.ipcRenderer.on("navigate", (_, path) => callback(path));
  },
  // Platform info
  platform: process.platform,
  isElectron: true,
  isDev: process.env.NODE_ENV === "development",
  // URL the renderer shell should load in the webview.
  // Resolved at preload time (Node.js context) so the renderer doesn't
  // need access to process.env.
  appUrl: process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://dryft.site",
  // Absolute path to this compiled preload script.
  // The renderer shell passes this to the <webview preload="..."> attribute
  // so that window.drift is also available inside the webview (for the web
  // app to call drift.minimizeWindow() etc.).
  preloadPath: __dirname + "/index.js",
  // ==========================================================================
  // Haptic / Intiface APIs
  // ==========================================================================
  // Get default Intiface URL
  getIntifaceUrl: () => electron.ipcRenderer.invoke("get-intiface-url"),
  // Update Intiface connection status (for tray menu)
  setIntifaceStatus: (connected) => {
    electron.ipcRenderer.send("intiface-status", connected);
  },
  // Open Intiface download page
  openIntifaceDownload: () => {
    electron.ipcRenderer.send("open-intiface-download");
  },
  // Show haptic device notification
  hapticNotification: (type, deviceName) => {
    electron.ipcRenderer.send("haptic-notification", { type, deviceName });
  },
  // Open device settings page
  openDeviceSettings: () => {
    electron.ipcRenderer.send("open-device-settings");
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("drift", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.drift = api;
}

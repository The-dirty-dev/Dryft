"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const electronUpdater = require("electron-updater");
const RENDERER_DEV_URL = process.env["ELECTRON_RENDERER_URL"];
const INTIFACE_DOWNLOAD_URL = "https://intiface.com/central/";
const INTIFACE_DEFAULT_URL = "ws://127.0.0.1:12345";
let mainWindow = null;
let tray = null;
let intifaceConnected = false;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0f0f23",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      // Required for the renderer shell's <webview> element
      webviewTag: true
    }
  });
  electron.nativeTheme.themeSource = "dark";
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (RENDERER_DEV_URL) {
    mainWindow.loadURL(RENDERER_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function createTray() {
  const iconPath = path.join(__dirname, "../../resources/tray-icon.png");
  try {
    tray = new electron.Tray(iconPath);
  } catch {
    return;
  }
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Open Dryft",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: "separator" },
    {
      label: "Haptic Devices",
      submenu: [
        {
          label: "Device Settings",
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send("navigate", "/settings/devices");
            } else {
              createWindow();
              mainWindow?.webContents.once("did-finish-load", () => {
                mainWindow?.webContents.send("navigate", "/settings/devices");
              });
            }
          }
        },
        {
          label: intifaceConnected ? "Intiface: Connected" : "Intiface: Disconnected",
          enabled: false
        },
        { type: "separator" },
        {
          label: "Download Intiface Central",
          click: () => {
            electron.shell.openExternal(INTIFACE_DOWNLOAD_URL);
          }
        }
      ]
    },
    { type: "separator" },
    {
      label: "Check for Updates",
      click: () => {
        electronUpdater.autoUpdater.checkForUpdatesAndNotify();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("Dryft");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    } else {
      createWindow();
    }
  });
}
function setupAutoUpdater() {
  electronUpdater.autoUpdater.autoDownload = true;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  electronUpdater.autoUpdater.on("update-available", () => {
    mainWindow?.webContents.send("update-available");
  });
  electronUpdater.autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update-downloaded");
  });
  electronUpdater.autoUpdater.on("error", (error) => {
    console.error("Auto-updater error:", error);
  });
  setInterval(() => {
    electronUpdater.autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1e3);
}
function setupIpcHandlers() {
  electron.ipcMain.handle("get-version", () => {
    return electron.app.getVersion();
  });
  electron.ipcMain.handle("check-updates", async () => {
    try {
      const result = await electronUpdater.autoUpdater.checkForUpdates();
      return result?.updateInfo?.version || null;
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("install-update", () => {
    electronUpdater.autoUpdater.quitAndInstall();
  });
  electron.ipcMain.on("minimize-window", () => {
    mainWindow?.minimize();
  });
  electron.ipcMain.on("maximize-window", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  electron.ipcMain.on("close-window", () => {
    mainWindow?.close();
  });
  electron.ipcMain.on("open-external", (_, url) => {
    electron.shell.openExternal(url);
  });
  electron.ipcMain.on("show-notification", (_, { title, body }) => {
    new electron.Notification({ title, body }).show();
  });
  electron.ipcMain.on("intiface-status", (_, connected) => {
    intifaceConnected = connected;
    if (tray) {
      createTray();
    }
  });
  electron.ipcMain.handle("get-intiface-url", () => {
    return INTIFACE_DEFAULT_URL;
  });
  electron.ipcMain.on("open-intiface-download", () => {
    electron.shell.openExternal(INTIFACE_DOWNLOAD_URL);
  });
  electron.ipcMain.on("haptic-notification", (_, { type, deviceName }) => {
    let title = "Dryft";
    let body = "";
    switch (type) {
      case "device-connected":
        title = "Device Connected";
        body = `${deviceName} is now connected`;
        break;
      case "device-disconnected":
        title = "Device Disconnected";
        body = `${deviceName} has been disconnected`;
        break;
      case "intiface-connected":
        title = "Intiface Central";
        body = "Connected to Intiface Central";
        break;
      case "intiface-disconnected":
        title = "Intiface Central";
        body = "Disconnected from Intiface Central";
        break;
      case "low-battery":
        title = "Low Battery";
        body = `${deviceName} battery is low`;
        break;
      default:
        return;
    }
    new electron.Notification({ title, body }).show();
  });
  electron.ipcMain.on("open-device-settings", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("navigate", "/settings/devices");
    }
  });
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("app.dryft.desktop");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  setupIpcHandlers();
  createWindow();
  createTray();
  if (!utils.is.dev) {
    setupAutoUpdater();
    electronUpdater.autoUpdater.checkForUpdatesAndNotify();
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("open-url", (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.show();
    mainWindow.webContents.send("deep-link", url);
  }
});
electron.app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    const allowed = parsed.protocol === "file:" || navigationUrl.startsWith("http://localhost:") || navigationUrl.startsWith("https://dryft.site") || navigationUrl.startsWith("https://updates.dryft.site");
    if (!allowed) {
      event.preventDefault();
      electron.shell.openExternal(navigationUrl);
    }
  });
});

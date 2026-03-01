import { app, shell, BrowserWindow, ipcMain, nativeTheme, Tray, Menu, Notification } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { autoUpdater } from 'electron-updater';

// The web app URL is exposed to the renderer shell via window.drift.appUrl
// (set in preload/index.ts). The BrowserWindow itself loads the renderer
// shell (index.html), which then creates a <webview> for the web app.
// In dev, electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server URL.
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL'];

const INTIFACE_DOWNLOAD_URL = 'https://intiface.com/central/';
const INTIFACE_DEFAULT_URL = 'ws://127.0.0.1:12345';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let intifaceConnected = false;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f0f23',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      // Required for the renderer shell's <webview> element
      webviewTag: true,
    },
  });

  // Force dark mode
  nativeTheme.themeSource = 'dark';

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Load the renderer shell (which in turn creates a <webview> for the web app)
  if (RENDERER_DEV_URL) {
    // Dev: electron-vite serves the renderer shell via its own Vite dev server
    mainWindow.loadURL(RENDERER_DEV_URL);
  } else {
    // Prod: load the built renderer shell from dist/renderer/
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Handle window close
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      // On macOS, hide instead of quit
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  // Create system tray icon
  const iconPath = join(__dirname, '../../resources/tray-icon.png');

  try {
    tray = new Tray(iconPath);
  } catch {
    // Tray icon not found, skip
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dryft',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Haptic Devices',
      submenu: [
        {
          label: 'Device Settings',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('navigate', '/settings/devices');
            } else {
              createWindow();
              mainWindow?.webContents.once('did-finish-load', () => {
                mainWindow?.webContents.send('navigate', '/settings/devices');
              });
            }
          },
        },
        {
          label: intifaceConnected ? 'Intiface: Connected' : 'Intiface: Disconnected',
          enabled: false,
        },
        { type: 'separator' },
        {
          label: 'Download Intiface Central',
          click: () => {
            shell.openExternal(INTIFACE_DOWNLOAD_URL);
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        autoUpdater.checkForUpdatesAndNotify();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Dryft');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
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

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
  });

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Get app version
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  // Check for updates
  ipcMain.handle('check-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result?.updateInfo?.version || null;
    } catch {
      return null;
    }
  });

  // Install update
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Window controls
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow?.close();
  });

  // Open external URL
  ipcMain.on('open-external', (_, url: string) => {
    shell.openExternal(url);
  });

  // Show notification
  ipcMain.on('show-notification', (_, { title, body }) => {
    new Notification({ title, body }).show();
  });

  // ==========================================================================
  // Haptic / Intiface IPC Handlers
  // ==========================================================================

  // Update Intiface connection status (called from renderer)
  ipcMain.on('intiface-status', (_, connected: boolean) => {
    intifaceConnected = connected;
    // Rebuild tray menu to reflect new status
    if (tray) {
      createTray();
    }
  });

  // Get Intiface default URL
  ipcMain.handle('get-intiface-url', () => {
    return INTIFACE_DEFAULT_URL;
  });

  // Open Intiface download page
  ipcMain.on('open-intiface-download', () => {
    shell.openExternal(INTIFACE_DOWNLOAD_URL);
  });

  // Show haptic device notification
  ipcMain.on('haptic-notification', (_, { type, deviceName }: { type: string; deviceName: string }) => {
    let title = 'Dryft';
    let body = '';

    switch (type) {
      case 'device-connected':
        title = 'Device Connected';
        body = `${deviceName} is now connected`;
        break;
      case 'device-disconnected':
        title = 'Device Disconnected';
        body = `${deviceName} has been disconnected`;
        break;
      case 'intiface-connected':
        title = 'Intiface Central';
        body = 'Connected to Intiface Central';
        break;
      case 'intiface-disconnected':
        title = 'Intiface Central';
        body = 'Disconnected from Intiface Central';
        break;
      case 'low-battery':
        title = 'Low Battery';
        body = `${deviceName} battery is low`;
        break;
      default:
        return;
    }

    new Notification({ title, body }).show();
  });

  // Navigate to device settings
  ipcMain.on('open-device-settings', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('navigate', '/settings/devices');
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Set app user model id for Windows
  electronApp.setAppUserModelId('app.dryft.desktop');

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  setupIpcHandlers();
  createWindow();
  createTray();

  // Setup auto-updater in production
  if (!is.dev) {
    setupAutoUpdater();
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle deep links
app.on('open-url', (event, url) => {
  event.preventDefault();

  if (mainWindow) {
    mainWindow.show();
    mainWindow.webContents.send('deep-link', url);
  }
});

// Security: The renderer shell only loads local file:// or the Vite dev server.
// External URL navigation from the shell is already handled by setWindowOpenHandler.
// The <webview> inside the shell manages its own navigation (dryft.site / localhost).
// Any unexpected new BrowserWindow navigation is blocked here as a safety net.
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    const allowed =
      parsed.protocol === 'file:' ||
      navigationUrl.startsWith('http://localhost:') ||
      navigationUrl.startsWith('https://dryft.site') ||
      navigationUrl.startsWith('https://updates.dryft.site');

    if (!allowed) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
});

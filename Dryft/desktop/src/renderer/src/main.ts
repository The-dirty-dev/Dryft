/**
 * Dryft Desktop — Renderer Shell Script
 *
 * Runs inside the BrowserWindow renderer (the shell), NOT inside the webview.
 * Accesses native Electron features through `window.drift` (injected by
 * the preload script via contextBridge).
 *
 * Responsibilities:
 *  - Create and manage the <webview> that hosts the Dryft web app
 *  - Wire up navigation buttons (back / forward / reload / home)
 *  - Handle window controls (minimize / maximize / close) for Windows/Linux
 *  - Show / hide loading and error screens on webview state changes
 *  - Show / hide the offline banner on network changes
 *  - Forward IPC messages from the main process (navigate, deep-link, updates)
 */

// --------------------------------------------------------------------------
// DOM references
// --------------------------------------------------------------------------

const webviewContainer  = document.getElementById('webview-container')!;
const loadingScreen     = document.getElementById('loading-screen')!;
const errorScreen       = document.getElementById('error-screen')!;
const errorDetail       = document.getElementById('error-detail')!;
const offlineBanner     = document.getElementById('offline-banner')!;
const statusDot         = document.querySelector('.status-dot')!;
const statusLabel       = document.querySelector('.status-label')!;
const updateIndicator   = document.getElementById('update-indicator') as HTMLButtonElement;

const btnBack       = document.getElementById('btn-back')   as HTMLButtonElement;
const btnForward    = document.getElementById('btn-forward') as HTMLButtonElement;
const btnReload     = document.getElementById('btn-reload')  as HTMLButtonElement;
const btnHome       = document.getElementById('btn-home')    as HTMLButtonElement;
const btnRetry      = document.getElementById('btn-retry')   as HTMLButtonElement;
const btnErrorRetry = document.getElementById('btn-error-retry') as HTMLButtonElement;
const btnMinimize   = document.getElementById('btn-minimize');
const btnMaximize   = document.getElementById('btn-maximize');
const btnClose      = document.getElementById('btn-close');
const windowControls = document.getElementById('window-controls');

// --------------------------------------------------------------------------
// App URL — injected by preload so the renderer doesn't need process.env
// --------------------------------------------------------------------------

const appUrl: string = (window as any).drift?.appUrl ?? 'https://dryft.site';

// --------------------------------------------------------------------------
// Create webview
// --------------------------------------------------------------------------

const webview = document.createElement('webview') as any;

webview.style.cssText = 'width:100%;height:100%;border:none;';

// Isolated session so cookies/storage are separate from the shell
webview.setAttribute('partition', 'persist:dryft');

// Disable popups — external links open in the system browser via did-new-window
webview.setAttribute('allowpopups', 'false');

webview.setAttribute('webpreferences', 'contextIsolation=yes,nodeIntegration=no');

webview.src = appUrl;
webviewContainer.appendChild(webview);

// --------------------------------------------------------------------------
// Navigation helpers
// --------------------------------------------------------------------------

function updateNavState(): void {
  btnBack.disabled    = !webview.canGoBack();
  btnForward.disabled = !webview.canGoForward();
}

function reload(): void {
  hideError();
  showLoading();
  webview.reload();
}

// --------------------------------------------------------------------------
// Screen state helpers
// --------------------------------------------------------------------------

function showLoading(): void {
  loadingScreen.classList.remove('hidden');
  errorScreen.classList.add('hidden');
}

function hideLoading(): void {
  loadingScreen.classList.add('hidden');
}

function showError(description?: string): void {
  hideLoading();
  errorDetail.textContent = description ?? '';
  errorScreen.classList.remove('hidden');
}

function hideError(): void {
  errorScreen.classList.add('hidden');
}

// --------------------------------------------------------------------------
// Online / offline
// --------------------------------------------------------------------------

function setOnlineState(online: boolean): void {
  if (online) {
    offlineBanner.classList.add('hidden');
    statusDot.className    = 'status-dot status-dot--connected';
    statusLabel.textContent = 'Connected';
  } else {
    offlineBanner.classList.remove('hidden');
    statusDot.className    = 'status-dot status-dot--offline';
    statusLabel.textContent = 'Offline';
  }
}

window.addEventListener('offline', () => setOnlineState(false));
window.addEventListener('online',  () => {
  setOnlineState(true);
  // If showing error screen when network comes back, retry automatically
  if (!errorScreen.classList.contains('hidden')) {
    reload();
  }
});

// Set initial state
setOnlineState(navigator.onLine);

// --------------------------------------------------------------------------
// Webview event listeners
// --------------------------------------------------------------------------

webview.addEventListener('did-start-loading', () => {
  statusDot.className = 'status-dot status-dot--loading';
  showLoading();
});

webview.addEventListener('did-finish-load', () => {
  statusDot.className = 'status-dot status-dot--connected';
  hideLoading();
  hideError();
  updateNavState();
});

webview.addEventListener('did-fail-load', (event: any) => {
  // Error -3 is ERR_ABORTED — happens on redirects, safe to ignore
  if (event.errorCode === -3) {
    hideLoading();
    return;
  }
  showError(event.errorDescription ?? '');
});

webview.addEventListener('did-navigate', () => {
  updateNavState();
});

webview.addEventListener('did-navigate-in-page', () => {
  updateNavState();
});

// Open new-window requests in the system browser instead of a new Electron window
webview.addEventListener('new-window', (event: any) => {
  (window as any).drift?.openExternal(event.url);
});

// --------------------------------------------------------------------------
// Navigation button handlers
// --------------------------------------------------------------------------

btnBack.addEventListener('click',   () => { if (webview.canGoBack())    webview.goBack(); });
btnForward.addEventListener('click',() => { if (webview.canGoForward()) webview.goForward(); });
btnReload.addEventListener('click', () => reload());
btnHome.addEventListener('click',   () => webview.loadURL(appUrl));
btnRetry.addEventListener('click',  () => reload());
btnErrorRetry.addEventListener('click', () => reload());

// --------------------------------------------------------------------------
// Window controls (Windows / Linux)
// --------------------------------------------------------------------------

// On macOS traffic lights provide close/min/max — hide our custom buttons
if ((window as any).drift?.platform === 'darwin') {
  if (windowControls) windowControls.style.display = 'none';
}

btnMinimize?.addEventListener('click', () => (window as any).drift?.minimizeWindow());
btnMaximize?.addEventListener('click', () => (window as any).drift?.maximizeWindow());
btnClose?.addEventListener('click',    () => (window as any).drift?.closeWindow());

// --------------------------------------------------------------------------
// IPC events forwarded from the main process via window.drift
// --------------------------------------------------------------------------

const drift = (window as any).drift;

if (drift) {
  // Tray menu → navigate to a path within the app
  drift.onNavigate((path: string) => {
    webview.loadURL(appUrl + path);
  });

  // Deep link (dryft:// URL scheme) forwarded to the web app
  drift.onDeepLink((url: string) => {
    webview.loadURL(url);
  });

  // Auto-updater events
  drift.onUpdateAvailable(() => {
    updateIndicator.classList.remove('hidden');
    updateIndicator.title = 'Update available — click to download';
  });

  drift.onUpdateDownloaded(() => {
    updateIndicator.classList.remove('hidden');
    updateIndicator.title = 'Update downloaded — click to install and restart';
    updateIndicator.querySelector('span')!.textContent = 'Restart to update';
    updateIndicator.addEventListener('click', () => {
      drift.installUpdate();
    }, { once: true });
  });
}

// --------------------------------------------------------------------------
// Update indicator (click to check while no update is pending)
// --------------------------------------------------------------------------

updateIndicator.addEventListener('click', () => {
  if (updateIndicator.title === 'Update available — click to download') return; // already handled above
  drift?.checkForUpdates?.();
});

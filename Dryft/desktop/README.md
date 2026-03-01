# Dryft Desktop App

The Dryft desktop app is an Electron wrapper around the web experience, with native integrations for haptics, tray controls, deep links, and auto-updates.

## Tech Stack

- **Runtime**: Electron 28
- **Build**: electron-vite
- **Packaging**: electron-builder
- **Updates**: electron-updater (generic provider)

## Prerequisites

- Node.js 18+
- npm or yarn

## Getting Started

```bash
cd desktop
npm install
npm run dev
```

The desktop app expects the web app to be running on `http://localhost:3000` in development.

## Scripts

```bash
npm run dev           # Run Electron in dev mode
npm run build         # Build production bundles
npm run preview       # Preview production build
npm run package       # Build installer for current OS
npm run package:mac   # Build macOS artifacts
npm run package:win   # Build Windows artifacts
npm run package:linux # Build Linux artifacts
```

## Architecture Overview

- **Main process** (`desktop/src/main/index.ts`)
  - Creates the `BrowserWindow` and loads the web app URL.
  - Manages tray menus, update checks, deep links, and native notifications.
  - Enforces external navigation rules and opens external URLs in the system browser.
- **Preload bridge** (`desktop/src/preload/index.ts`)
  - Exposes a `window.drift` API for the renderer/web app via `contextBridge`.
  - Provides IPC for updates, window controls, deep links, and haptic/Intiface events.
- **Renderer shell** (`desktop/src/renderer/index.html`)
  - Lightweight chrome (title bar, navigation buttons, status indicators).
  - The actual UI is the hosted web app (no separate React renderer bundle).

## Runtime Behavior

- **App URL**
  - Dev: `http://localhost:3000`
  - Prod: `https://dryft.site`
- **Deep links**
  - `open-url` events are forwarded to the web app via IPC (`deep-link`).
- **Navigation safety**
  - External URLs open in the system browser; navigation is restricted to the app origin.

## Intiface Integration (Haptics)

The desktop app integrates with Intiface Central to control local haptic devices:

- Tray menu includes a **Haptic Devices** submenu with quick access.
- The preload bridge exposes:
  - `getIntifaceUrl()` for the default local WS endpoint (`ws://127.0.0.1:12345`).
  - `setIntifaceStatus()` to reflect connection state in the tray.
  - `openIntifaceDownload()` to open the Intiface Central download page.
  - `openDeviceSettings()` to navigate to `/settings/devices` in the web UI.

## Auto-Updater

The updater is configured via `electron-updater` and runs in production:

- Checks on launch and then hourly.
- Sends `update-available` and `update-downloaded` events to the renderer.
- Update artifacts are served from `https://updates.dryft.site`.

## System Tray

The tray provides quick access to:

- Open Dryft (show/focus window)
- Haptic device settings and Intiface status
- Check for updates
- Quit

## Packaging Targets

Configured in `desktop/package.json`:

- **macOS**: `dmg`, `zip` (hardened runtime, custom entitlements)
- **Windows**: `nsis`, `portable`
- **Linux**: `AppImage`, `deb`

Artifacts are output to `desktop/release/`.

# Dryft Web App

The Dryft web app is a Next.js (App Router) frontend used for the browser experience and as the UI surface embedded in the desktop app.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript + React 18
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Testing**: Vitest + Testing Library

## Prerequisites

- Node.js 18+
- npm or yarn

## Getting Started

```bash
cd web
npm install
npm run dev
```

The app runs on `http://localhost:3000` by default.

## Environment Variables

The web app reads these `NEXT_PUBLIC_*` variables at build/runtime. Defaults are used when unset, so local development works without a `.env` file.

- `NEXT_PUBLIC_API_URL` (default: `http://localhost:8080`)
- `NEXT_PUBLIC_WS_URL` (default: `ws://localhost:8080/v1/ws`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

## Scripts

```bash
npm run dev           # Start Next.js dev server
npm run build         # Production build
npm run start         # Serve production build
npm run lint          # ESLint
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage
```

## Architecture Overview

- **App Router pages** live in `web/src/app`, organized by feature route (e.g., `discover`, `messages`, `settings`).
- **API access** is centralized in `web/src/lib/api.ts` and related helpers.
- **WebSocket chat** logic lives in `web/src/lib/chatSocket.ts` with `NEXT_PUBLIC_WS_URL` as the default endpoint.
- **State** is managed with Zustand stores under `web/src/store`.
- **Shared UI** components live in `web/src/components` and feature-specific components under subfolders (e.g., `calls`).

## Testing

Tests are located in `web/src/__tests__`, with setup in `web/src/__tests__/setup.ts`.

## E2E Testing (Playwright)

End-to-end specs live in `web/e2e/` with config in `web/playwright.config.ts`.
The scaffold is present, but Playwright dependencies/scripts are not yet wired in `package.json`.
If you plan to run E2E locally, add `@playwright/test` and a script such as `npm run test:e2e`.

## Web Push Notifications

Web push uses the service worker at `web/public/firebase-messaging-sw.js`. It expects Firebase config
via `NEXT_PUBLIC_FIREBASE_*` variables and a VAPID key (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`).
Push notifications require HTTPS in production (or `http://localhost` in dev).

## Relationship to Desktop

The desktop app loads this web app directly in its Electron `BrowserWindow`. When working on desktop, keep the web dev server running on `http://localhost:3000`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dryft is a multi-platform dating app with mobile (Expo/React Native), web (Next.js), desktop (Electron), VR (Unity/Meta Quest), and a Go backend. All clients share a single REST+WebSocket API.

## Repository Layout

```
backend/       Go API server (chi router, PostgreSQL, Redis, WebSocket hub)
mobile/        React Native app via Expo SDK 50
web/           Next.js 14 app (App Router, Tailwind, Vitest)
desktop/       Electron app (electron-vite, loads web app)
vr-dryft/      Unity 2022.3 LTS project (Normcore multiplayer, XR Toolkit)
shared/types/  @dryft/shared-types — shared TypeScript type definitions
docs/          Legal docs, app store metadata
```

## Build & Run Commands

### Backend (Go 1.24, working dir: `backend/`)

| Task | Command |
|---|---|
| Run locally | `make run` |
| Build binary | `make build` |
| All tests | `make test` |
| Tests verbose | `make test-v` |
| Tests with race detector | `make test-race` |
| Integration tests (needs Docker) | `make test-integration` |
| Single package test | `go test ./internal/auth/... -count=1 -v` |
| Single test function | `go test ./internal/auth/... -run TestTokenGeneration -count=1 -v` |
| Lint | `make lint` (requires golangci-lint) |
| Format | `make fmt` |
| Run migrations | `make migrate` |
| Start Postgres+Redis | `make docker-up` |
| Full CI locally | `make ci` |

### Web (Next.js 14, working dir: `web/`)

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| All tests | `npm test` |
| Watch mode | `npm run test:watch` |
| Single test file | `npx vitest run src/__tests__/home.test.tsx` |
| Lint | `npm run lint` |

### Mobile (Expo SDK 50, working dir: `mobile/`)

| Task | Command |
|---|---|
| Dev server | `npm start` |
| All tests | `npm test` |
| Watch mode | `npm run test:watch` |
| Single test file | `npx jest src/__tests__/notifications.test.ts` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| EAS build (dev) | `npm run build:dev` |

### Desktop (Electron, working dir: `desktop/`)

| Task | Command |
|---|---|
| Dev mode | `npm run dev` |
| Build | `npm run build` |
| Package (current platform) | `npm run package` |

## Architecture Details

### Backend

- **Entry point**: `cmd/dryft-api/main.go` — boots config, DB, Redis, all services, and the chi router.
- **Package convention**: Each domain lives in `internal/<domain>/` with its own handler, service, and (optionally) repository files. Handlers mount on the chi router; services hold business logic; DB queries use `pgx/v5` directly (not GORM, except in a few legacy spots that use `gorm`).
- **Auth flow**: JWT access tokens (15 min) + refresh tokens (7 days). Middleware: `RequireAuth`, `RequireVerified`, `OptionalAuth`. Age verification (Jumio + Stripe card check + Rekognition face match) is enforced before accessing WebSocket, matching, or chat.
- **Real-time**: A single WebSocket hub (`internal/realtime/hub.go`) handles chat, typing indicators, call signaling (WebRTC), presence, match notifications, haptic events, and companion session sync. Auth via middleware context or `?token=` query param.
- **Migrations**: SQL files in `internal/database/migrations/` (001–010). Applied via `-migrate` flag on the binary or `make migrate`. Each has a corresponding `.down.sql`.
- **Config**: All via environment variables read in `internal/config/config.go`. See `backend/.env.example` for the full list. Optional services (Redis, Firebase, APNs, S3) degrade gracefully when unconfigured.
- **Docker**: `docker-compose.yml` starts PostgreSQL 16, Redis 7, and the API. Use `make docker-up`.

### Web

- **App Router** (not Pages Router). Routes under `src/app/`.
- **State management**: Zustand (planned; store dir exists).
- **API base URL**: `NEXT_PUBLIC_API_URL` env var, defaults to `http://localhost:8080`.
- **Styling**: Tailwind CSS.
- **Testing**: Vitest + `@testing-library/react`. Config in `vitest.config.ts`. Setup in `src/__tests__/setup.ts`.

### Mobile

- **Navigation**: React Navigation with native-stack and bottom-tabs. Config in `src/navigation/`.
- **State management**: Zustand with 8 stores in `src/store/` (auth, marketplace, matching, offline, onboarding, settings, subscription, verification).
- **i18n**: i18next with 6 locales in `src/i18n/locales/` (en, es, fr, de, ja, pt).
- **Deep linking**: `dryft://` scheme, config in `src/navigation/linking.ts`.
- **Testing**: Jest (expo preset) + React Native Testing Library. Setup in `src/__tests__/setup.ts`.

### Desktop

- **Main process** (`src/main/index.ts`): Creates BrowserWindow loading the web app URL. Integrates Intiface (haptic devices at `ws://127.0.0.1:12345`), auto-updater, and system tray.
- **Build**: electron-builder with targets for macOS (DMG), Windows (NSIS), Linux (AppImage/deb).

### VR (Unity)

- **Networking**: Normcore for multiplayer rooms (public lounge, private booths).
- **Scripts**: `Assets/Scripts/` organized by domain (Core, Auth, Player, Environment, Networking, Haptics, Marketplace, UI, Safety, etc.).
- **Entry point**: `SceneBootstrap.cs` initializes managers; `DriftRealtime.cs` wraps Normcore room management.
- **Rendering**: URP with custom `NeonGlow.shader`.
- **Build target**: Meta Quest (Android SDK 29+), also supports PC VR.

## Code Style & Formatting

- **Prettier** (root `.prettierrc`): single quotes, semicolons, trailing commas, 100 char width, 2-space tabs, LF line endings.
- **Go**: `gofmt -s` (run `make fmt`). golangci-lint for static analysis.
- **TypeScript**: ESLint in both web and mobile with React/hooks plugins.

## CI Pipeline (`.github/workflows/ci.yml`)

Runs on push to `main` and PRs against `main`. Jobs: `backend` (Go lint/build/test), `mobile` (typecheck/lint/test), `web` (lint/test/build), `e2e` (Playwright, PR-only), `docker` (build/push on main), `deploy-staging` (main only, after all jobs pass).

## Multi-Agent Workflow

This project uses multiple AI agents coordinated via `AGENTS_COLLAB.md` (append-only log). See that file for the collaboration protocol. CLAUDE-Architect (Claude Code) is the lead architect; Codex agents handle tests, refactors, and docs in scoped areas.

### Safe Areas for Codex Agents

- Test files (`**/__tests__/**`, `**/tests/**`)
- Documentation files (README, DEPLOYMENT, comments)
- Small refactors in `src/components/`, `src/screens/`, `src/hooks/`
- CI workflow tweaks
- Translation files (`mobile/src/i18n/locales/`)

### Dangerous Areas (Require CLAUDE-Architect Review)

- `backend/internal/auth/` — JWT, token refresh, age verification
- `backend/internal/realtime/` — WebSocket hub, presence, session sync
- `backend/internal/database/migrations/` — schema changes
- `backend/internal/config/` — env var handling, secrets
- `backend/internal/safety/` — content moderation, reporting
- `backend/internal/agegate/` — ID verification, Jumio/Stripe integration
- `backend/cmd/dryft-api/main.go` — service wiring and startup
- `mobile/src/store/authStore.ts` — auth state management
- `vr-dryft/Assets/Scripts/Core/` and `Auth/` — VR auth and Normcore wiring

## Key Environment Variables

Backend requires at minimum: `DATABASE_URL`, `JWT_SECRET_KEY` (32+ chars), `ENCRYPTION_KEY` (exactly 32 bytes). For full feature set: Stripe keys, Jumio credentials, Firebase JSON, APNs key, AWS/S3 config. See `backend/.env.example`.

## Local Development Quick Start

```sh
# 1. Start backing services
cd backend && make docker-up

# 2. Run backend (in backend/)
cp .env.example .env   # fill in secrets
make run

# 3. Run web (in web/)
npm install && npm run dev

# 4. Run mobile (in mobile/)
npm install && npm start
```

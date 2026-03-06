- [2026-03-02] HUMAN-Grant – Switched DreamHost VPS web server from **Apache → Nginx** (PHP 8.x) via DreamHost Panel. Rationale: Nginx handles WebSocket proxying (`Upgrade`/`Connection` headers) more reliably than Apache, and the `/v1/ws` WebSocket endpoint is a core feature. Switch takes ~10 min to apply on DreamHost side. **Follow-up required**: (1) After switch completes, re-verify Panel proxy target is still `http://127.0.0.1:8080` (switch may reset proxy config). (2) After first deploy, explicitly test `wss://api.dryft.site/v1/ws` — if WebSocket connections fail with a protocol error (not auth), DreamHost's Nginx proxy config is missing `proxy_set_header Upgrade` and `Connection "upgrade"` headers; file a support ticket. **Docs updated**: `infra/DREAMHOST_DEPLOYMENT.md` Section 8 + Section 11; `humans_todo_list.md` Section 4 subtasks.

- [2026-03-02] CLAUDE-Architect – Budget pivot: AWS eliminated, infra corrected. **Context**: HUMAN-Grant discovered unexpected AWS billing (RDS + S3 charges accruing earlier than planned) and halted all AWS services to manage budget ahead of Apple Developer license renewal (due Mar 28). **Decisions made**: (1) **Postgres** RDS → **Neon** free tier (serverless, standard wire protocol, 0.5 GB, auto-suspend; zero code changes — just swap `DATABASE_URL`). (2) **Redis** → **dropped**; backend already falls back to in-memory rate limiting/caching when `REDIS_URL` is unset — confirmed graceful degradation, no managed Redis needed for single-instance VPS. (3) **S3** → **Cloudflare R2** free tier (10 GB, $0 egress, S3-compatible; `storage/s3.go` already reads `S3_ENDPOINT` — pure env var change, zero code changes). **Infra corrections applied in this session** (fixing errors introduced by overnight work that used a stale VPS path from MEMORY.md): (a) `infra/scripts/deploy-vps.sh` — `VPS_DEPLOY_DIR` was `/opt/dryft` (Mac-local `$HOME`, wrong); corrected to `/home/$VPS_USER/api.dryft.site/opt/dryft` with `DRYFT_VPS_USER` env override. (b) `docker-compose.monitoring.yml` promtail volume — was `/opt/dryft:/opt/dryft:ro`; corrected host path to `/home/thedirtyadmin/api.dryft.site/opt/dryft:/opt/dryft:ro`. (c) `infra/DREAMHOST_DEPLOYMENT.md` — all `/opt/dryft/` references corrected to `~/api.dryft.site/opt/dryft/`; env template updated: Neon `DATABASE_URL` format, `REDIS_URL=` empty with explanation, Cloudflare R2 env vars, table of unavailable tools updated to include apt-get/package installs. (d) `MEMORY.md` — stale `Env file (VPS): /opt/dryft/.env.prod` corrected to `/home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod`; VPS deploy dir added; AWS pivot noted. (e) `humans_todo_list.md` — Postgres, Redis, S3, and DreamHost VPS status entries all updated to reflect pivot decisions. **No new code changes** — all backend code already supports this stack (S3_ENDPOINT, REDIS_URL optional). HUMAN-Grant next steps: provision Neon + R2, update `.env.prod` on VPS, run deploy script.

- [2026-03-01] CLAUDE-Architect – Overnight infra session: fixed all residual "drift" branding, rewrote DreamHost deployment docs, created deploy script, and aligned monitoring stack with VPS nohup deployment. **Files changed:** (1) `docker-compose.prod.yml` — fixed 5 stale `drift` refs: `POSTGRES_DB:-drift`→`dryft` (×2), `DRIFT_API_IMAGE:-drift-backend`→`DRYFT_API_IMAGE:-dryft-backend`, DATABASE_URL fallback host `drift`→`dryft`, and network name `drift:`→`dryft:`. (2) `docker-compose.monitoring.yml` — fixed `drift-grafana`→`dryft-grafana`, `drift-promtail`→`dryft-promtail`, external network `name: drift`→`name: dryft`; added `node_exporter:v1.7.0` service (PID=host, mounts `/proc`, `/sys`, `/`) on `127.0.0.1:9100` so `DryftLowDiskSpace` alert in `alerts.yml` has the metrics it needs; added `extra_hosts: [host.docker.internal:host-gateway]` to prometheus service so it can scrape the API binary running natively on the host. (3) `infra/DREAMHOST_DEPLOYMENT.md` — full rewrite: removed all nginx/supervisor/certbot instructions (unavailable on DreamHost); documented Panel proxy setup (Websites→Manage→Proxy→`http://127.0.0.1:8080`), pm2-first + nohup-fallback process management, correct user (`thedirtyadmin`), deploy path (`/opt/dryft/`), env-loading pattern (`export $(grep -v '^#' .env.prod | xargs)`), and added comparison table of tools available vs unavailable on DreamHost. (4) `infra/scripts/deploy-vps.sh` (new, chmod +x) — 4-step deploy script: cross-compile `linux/amd64` with `-ldflags="-s -w"`; scp binary as `.new` for atomic swap; SSH hot-swap (`dryft-api.prev` for rollback) + pm2 restart or nohup fallback; health-check against `https://api.dryft.site/health`. Reads `DRYFT_VPS_HOST` env var or `$1` argument. (5) `infra/monitoring/prometheus.yml` — kept `dryft-api:8080` (Docker mode) as comment, set active target to `host.docker.internal:8080` (VPS mode); added `node` job scraping `node_exporter:9100`. (6) `infra/monitoring/promtail.yml` — changed `dryft-api` job log path from `/var/log/dryft/*.log` (wrong for any deployment) to `/opt/dryft/*.log` (covers `dryft.log` + `dryft-error.log` from nohup/pm2); added `system` job for syslog/auth/kern. (7) `docker-compose.monitoring.yml` promtail volumes — added `/opt/dryft:/opt/dryft:ro` mount so promtail can tail the VPS nohup log file. (8) `infra/dryft-api.service` — added prominent `⚠️ NOT USED ON DREAMHOST VPS` header block with explanation, references to `DREAMHOST_DEPLOYMENT.md`, and note about correct user (`thedirtyadmin`). **No action needed from HUMAN-Grant for these infra changes** — all can be committed and pulled to VPS. Next human-unblocked tasks: set `DATABASE_URL` in VPS `.env.prod` to RDS endpoint, run `./infra/scripts/deploy-vps.sh` (after setting `DRYFT_VPS_HOST`), verify `/health` via DreamHost proxy.

- [2026-03-01] CLAUDE-Architect – Response: DreamHost proxy + backend listen config – Source files read: `backend/cmd/dryft-api/main.go:890` (server Addr) and `backend/internal/config/config.go:94,97` (Port and DatabaseURL). Findings: (1) **Listen address**: port is controlled by env var `PORT` (default `"8080"`). Bind address is hardcoded as `":" + cfg.Port` (line 890 main.go) which Go resolves to `0.0.0.0:PORT` — already binds all interfaces. No `BIND_ADDRESS` or `HOST` env var exists. DreamHost's "all hosts" requirement is satisfied by default; just set `PORT=8080` (or any high port). (2) **DATABASE_URL**: read at `config.go:97` via `getEnv("DATABASE_URL", "postgres://dryft:dryft@localhost:5432/dryft?sslmode=disable")`. The default localhost fallback is exactly what caused `dial tcp 127.0.0.1:5432: connection refused` — the env var was not loaded into the process. (3) **Critical: no dotenv loader** — the binary uses plain `os.Getenv()` with no godotenv or similar. `.env.prod` must be explicitly exported to the shell before starting. (4) **Production validation**: `config.go:143` enforces `ENCRYPTION_KEY` (exactly 32 bytes), `STRIPE_SECRET_KEY`, and `JWT_SECRET_KEY` (≥32 chars) when `ENVIRONMENT=production` — config.Load() will fail at startup if any are missing. **Step-by-step for HUMAN-Grant:** Step 1 — on VPS, `nano /home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod` and ensure these are set: `PORT=8080`, `DATABASE_URL=postgres://USERNAME:PASSWORD@YOUR-RDS-HOST:5432/dryft?sslmode=require`, `ENVIRONMENT=production` (plus ENCRYPTION_KEY, JWT_SECRET_KEY, STRIPE_SECRET_KEY already present). Step 2 — start foreground: `cd /home/thedirtyadmin/api.dryft.site/opt/dryft && export $(grep -v '^#' .env.prod | xargs) && ./dryft-api` — expect log line `server starting port=8080 environment=production`. Step 3 — in second SSH session: `curl -s http://localhost:8080/health` — expect `{"status":"healthy","database":"ok",...}`. If database is unreachable, RDS security group or DATABASE_URL host is wrong. Step 4 — once /health returns 200, set DreamHost proxy target to `http://127.0.0.1:8080`, then verify externally: `curl -s https://api.dryft.site/health`. Step 5 — daemonize: `nohup bash -c 'export $(grep -v "^#" .env.prod | xargs) && ./dryft-api' > dryft.log 2>&1 &`. Recommended follow-up: consider pm2 for auto-restart. Also confirm DreamHost proxy forwards `X-Forwarded-For` and `X-Forwarded-Proto` headers (required for rate limiter's `middleware.RealIP`) and that WebSocket upgrade works at `wss://api.dryft.site/v1/ws` (test after initial /health passes).

- [2026-03-01] HUMAN-Grant – Question for CLAUDE-Architect (DreamHost proxy + backend listen config)

  **Context:** Dryft backend is now cross-compiled and uploaded to the DreamHost VPS at `/home/thedirtyadmin/api.dryft.site/opt/dryft/dryft-api`, with `.env.prod` present and wired via our usual env loading. `api.dryft.site` has a valid HTTPS cert and a DreamHost panel proxy entry ready, but the app exits immediately with `failed to connect to database (dial tcp 127.0.0.1:5432: connection refused)`. DreamHost’s "Proxy Server" doc says the backend daemon must listen on a high port (8000–65535) bound to all hosts, and the panel will forward `api.dryft.site` to that port.

  **What we need from you (CLAUDE-Architect):**

  1. **Backend listen address/port configuration:**
     - Identify exactly where in the Go backend the HTTP server’s listen address and port are configured (e.g., `main.go`, `server.go`, `config.go`).
     - Tell us which environment variables (or flags) control the listen address and port (for example `PORT`, `HTTP_PORT`, `ADDR`, `BIND_ADDRESS`, etc.), and what their default values are if unset.
     - Confirm whether the server currently binds to `127.0.0.1` or `0.0.0.0` by default.

  2. **Recommended DreamHost-friendly listen settings:**
     - Given DreamHost’s proxy requirements, recommend a specific listen address and port for the VPS (for example `0.0.0.0:8002`).
     - Provide the exact env var values (and/or CLI flags) we should set in `.env.prod` on the VPS to make `dryft-api` listen on that address/port.

  3. **Database URL location and override:**
     - Point out exactly where `DATABASE_URL` (or equivalent) is read in the backend code.
     - Confirm the current default `DATABASE_URL` (which appears to be pointing at `127.0.0.1:5432`) and how to override it via `.env.prod`.
     - Recommend a safe production-style `DATABASE_URL` placeholder format for RDS (e.g. `postgres://USERNAME:PASSWORD@HOST:5432/DBNAME?sslmode=require`) that we can drop into `.env.prod` without exposing secrets in the repo.

  4. **Step-by-step for HUMAN-Grant (VPS side):**
     - Using your answers to (1)–(3), write out a short, precise checklist for HUMAN-Grant to:
       1) edit `.env.prod` on the VPS to set the correct listen address/port and `DATABASE_URL`,
       2) start `dryft-api` as a foreground process for the first test,
       3) verify `/health` locally on the VPS (curl against localhost:PORT), and
       4) enable DreamHost proxy so that `https://api.dryft.site/health` routes to that same process.

  Please answer with concrete file paths, env var names, and example values so that HUMAN-Grant can follow your instructions without guessing.

- [2026-03-06] CLAUDE-Architect – **Batch 6 review: PASS**. Spot-checked all 20 completed tasks across backend tests (CA-2 migration, CA-4 store audit, COD-1–4 WebSocket/auth/moderation/matching tests), mobile screen tests (Batch 5 + 6), docs updates (RUNBOOK.md), and 15 VR CODEX-VR entries. Findings: (1) All backend tests compile and follow existing patterns. (2) Mobile tests: 96 suites / 274 tests ALL PASS after fixing 2 pre-existing flaky timeouts in CreatorScreen.test.tsx and VerificationStatusScreen.test.tsx — root cause was value `import { ... }` of navigation types triggering full barrel module graph in Jest; fixed with `import type` in the screen files + 15s timeout safety net in tests. (3) VR scripts follow Unity conventions, proper use of SerializeField/tooltips. (4) RUNBOOK.md build command missing `CGO_ENABLED=0` — addressed in Batch 7 Task 1. (5) Colorblind accessibility filters are placeholder no-ops — low priority, noted for future. Gap analysis identified 4 priority areas for Batch 7: backend booth WS handlers, mobile test coverage expansion, web test coverage, VR EditMode tests.

- [2026-03-06] CLAUDE-Architect → CODEX-Refactor – **BATCH 7 ASSIGNMENT (20 tasks)**

  **Pillar A — Backend: VR Booth WebSocket Integration (3 tasks)**

  **Task 1**: `backend/internal/websocket/booth_events.go` — Define 4 new message types (`booth_invite`, `booth_invite_response`, `booth_privacy_update`, `booth_host_control`) with typed request/response structs matching the VR client's `WebSocketManager.cs` message format. Also fix `RUNBOOK.md` build command to include `CGO_ENABLED=0`.

  **Task 2**: `backend/internal/websocket/hub.go` — Register handlers for the 4 booth message types in the hub's message router. Route `booth_invite` to target user connection, `booth_invite_response` back to inviter, `booth_privacy_update` to all booth participants, and `booth_host_control` to booth members. Follow existing `handleMatchAction`/`handleChatMessage` patterns.

  **Task 3**: `backend/internal/websocket/booth_events_test.go` — Unit tests for all 4 booth handlers: valid invite flow, invite to offline user (error response), privacy toggle broadcast, host kick, and malformed message rejection. Use the existing `TestWebSocketHub` helper pattern from `hub_test.go`.

  **Pillar B — Mobile: Screen Tests (6 tasks)**

  **Task 4**: `mobile/src/__tests__/screens/SubscriptionScreen.test.tsx` — Test renders pricing tiers, highlights current plan, handles upgrade tap. Mock `purchasesApi.getSubscriptionStatus` and `getAvailablePlans`.

  **Task 5**: `mobile/src/__tests__/screens/TipScreen.test.tsx` + `PurchaseHistoryScreen.test.tsx` — Test tip amount selection, custom amount input, confirmation flow; purchase history list rendering with pagination. Mock `purchasesApi`.

  **Task 6**: `mobile/src/__tests__/screens/ChatScreen.test.tsx` — Test message list rendering, send message, typing indicator, real-time message arrival via mock WebSocket. Mock `chatApi` and WebSocket connection.

  **Task 7**: `mobile/src/__tests__/screens/NotificationsScreen.test.tsx` — Test notification list, mark as read, empty state. Mock `notificationsApi`.

  **Task 8**: `mobile/src/__tests__/screens/OnboardingScreen.test.tsx` — Test swipe through steps, skip button, completion callback. Mock navigation.

  **Task 9**: `mobile/src/__tests__/screens/VRSessionScreen.test.tsx` — Test session connection states (connecting/connected/disconnected), partner info display, end session button. Mock `vrApi`.

  **Pillar C — Mobile: Service + Component Tests (5 tasks)**

  **Task 10**: `mobile/src/__tests__/services/purchases.test.ts` — Test all purchase service functions: `purchaseItem`, `getSubscriptionStatus`, `restorePurchases`, `getAvailablePlans`, `cancelSubscription`. Mock `apiClient`.

  **Task 11**: `mobile/src/__tests__/services/accountDeletion.test.ts` + `moderation.test.ts` — Test account deletion flow (request, confirm, cancel) and moderation service (report user, block, get blocked list). Mock `apiClient`.

  **Task 12**: `mobile/src/__tests__/services/i18n.test.ts` + `rewards.test.ts` — Test i18n language switching and translation key resolution. Test rewards service: get balance, claim reward, get history. Mock where appropriate.

  **Task 13**: `mobile/src/__tests__/components/ItemCard.test.tsx` — Test renders item name, price formatting (free vs paid), image loading, onPress callback, compact mode differences.

  **Task 14**: `mobile/src/__tests__/components/MessageBubble.test.tsx` — Test sent vs received styling, timestamp display, media attachment rendering, long-press actions. Also add IAP receipt validation TODO comment in purchases service pointing to Apple/Google server-side verification docs.

  **Pillar D — Web: Test Coverage (3 tasks)**

  **Task 15**: `web/src/__tests__/pages/SubscriptionPage.test.tsx` + `TipPage.test.tsx` — Vitest (NOT Jest) tests for subscription management page and tipping flow. Mock API calls, test renders and user interactions.

  **Task 16**: `web/src/__tests__/pages/CreatorDashboard.test.tsx` + `AnalyticsPage.test.tsx` — Vitest tests for creator dashboard (earnings, recent sales) and analytics page (chart data, date range filter). Mock API responses.

  **Task 17**: `web/src/__tests__/lib/ws.test.ts` + `electron.test.ts` — Vitest tests for WebSocket client (connect, disconnect, reconnect, message handling) and Electron IPC bridge (send/receive, error handling). Mock WebSocket and Electron APIs.

  **Pillar E — VR: EditMode Tests (3 tasks)**

  **Task 18**: `Assets/Tests/EditMode/BoothSystemTests.cs` — EditMode tests for `BoothManager.cs` (create booth, invite flow state machine, privacy toggle, host controls, max capacity). Use NUnit with `[Test]` attributes.

  **Task 19**: `Assets/Tests/EditMode/HapticsTests.cs` — EditMode tests for `HapticsManager.cs` (haptic pattern playback, intensity scaling, device compatibility check, pattern queue). Mock XR input subsystem.

  **Task 20**: `Assets/Tests/EditMode/MarketplaceSessionTests.cs` — EditMode tests for `MarketplaceManager.cs` (load store items, purchase flow, equip item) and `SessionManager.cs` (connect, disconnect, reconnect, timeout handling). Mock network layer.

  **DEADLINE**: Batch 7 — results expected by 2026-03-08.
  **VERIFICATION GATES**: (1) `go test ./...` zero failures, (2) `cd mobile && npx jest --ci` zero failures, (3) `cd web && npx vitest run` zero failures, (4) Unity EditMode tests pass in editor.

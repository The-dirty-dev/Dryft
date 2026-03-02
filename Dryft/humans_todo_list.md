# Human TODO List

This file tracks human-executable deployment and ops tasks for Dryft.
It is also the coordination point between HUMAN-Grant, CLAUDE-Architect, and Perplexity.
- HUMAN-Grant: works through concrete, bite-sized steps and records decisions.
- CLAUDE-Architect: reviews infra/architecture changes, validates approaches, and handles dangerous-area edits.
- Perplexity: helps decompose tasks, update this file, and guide step-by-step execution without touching dangerous code paths.

## Repo and Git Hygiene

- [x] Mount external volume `/Volumes/dryft-code` for project storage.
- [x] Copy legacy Dryft project codebase into `/Volumes/dryft-code/Dryft`.
- [x] Initialize local Git repository in `/Volumes/dryft-code/Dryft`.
- [x] Configure `.gitignore` so `node_modules` and OS metadata are ignored.
- [x] Configure Git LFS to track large Electron and Next.js SWC binaries.
- [x] Commit `.gitattributes` changes for Git LFS tracking.
- [x] Create private GitHub repository for Dryft.
- [x] Add GitHub remote (`origin`) to local repo.
- [x] Push `main` branch to GitHub and verify files/commits in the web UI.
- [x] Ensure local secrets files at volume root (`Secrets.rtf`, `.env.prod`, Firebase JSON, etc.) are not tracked or pushed.

## Production Readiness Tasks

1. Wire Alertmanager to Slack/PagerDuty. *(Slack wired and verified; PagerDuty deferred pending budget, Alertmanager tuning optional later.)*
2. Provision and load production secrets.
3. Configure TLS/SSL at the edge.
4. Deploy Prometheus/Grafana monitoring.
5. Run manual end-to-end testing pass.

---

### 1. Wire Alertmanager to Slack/PagerDuty

Status: **DONE** (Feb 14). Slack alerts confirmed working in `#drift-prod-alerts`. PagerDuty deferred.

Subtasks (completed / remaining):

1.1 Decide provider and channel
- [x] Choose providers (Slack now, PagerDuty later when budget allows).
- [x] Create `#drift-prod-alerts` Slack channel.

1.2 Create webhook / integration
- [x] Slack: create incoming webhook for `#drift-prod-alerts` and configure URL in `alertmanager.yml`.
- [ ] PagerDuty: create Events API v2 integration on "Dryft Production" service and wire into Alertmanager (deferred until closer to live prod).

1.3 Locate Alertmanager config in the repo
- [x] Open `infra/monitoring/alertmanager.yml` and confirm `route` and `receivers` sections exist.

1.4 Add or update receivers
- [x] Add `slack-critical` receiver with Slack webhook URL and message template.
- [ ] Add `pagerduty-critical` receiver with integration key (deferred).

1.5 Wire alerts to the receivers
- [x] Add `routes` entry matching `severity="critical"` and send to `slack-critical`.

1.6 Restart/reload Alertmanager
- [x] Use `docker compose -f docker-compose.monitoring.yml restart alertmanager` to apply config.
- [x] Investigate and resolve Alertmanager restart loop — **FIXED by CLAUDE-Architect** (missing `default` receiver, bad matcher syntax).

1.7 Send and confirm a test alert
- [x] Add `DriftTestCriticalAlert` (always-firing vector(1) with `severity: critical`) in `infra/monitoring/alerts.yml`.
- [x] Restart Alertmanager and confirm Slack receives `DriftTestCriticalAlert` — **Confirmed working (Feb 14)**.
- [x] Check `#drift-prod-alerts` Slack channel for test alert notification — **Confirmed (Feb 14)**.
- [x] Decision: **Keep** `DriftTestCriticalAlert` in `infra/monitoring/alerts.yml` for future smoke testing.

---

### 2. Auth response shape mismatch (frontend vs backend)

Status: **DONE** (CLAUDE-Architect, Feb 13; human-verified Feb 14)

- [x] Backend returns nested `tokens` object
- [x] `localStorage` confirmed to have correct shape
- [x] Protected endpoint returns 403 `VERIFICATION_REQUIRED` (auth works, age gate enforced)

#### Alertmanager Fix Summary (CLAUDE-Architect, Feb 11)

**Root cause**: The config referenced `receiver: default` but no `default` receiver was defined.

**Changes made to `infra/monitoring/alertmanager.yml`**:
- Added `global` section with `resolve_timeout: 5m`
- Fixed matcher syntax (removed outer quotes)
- Added three receivers: `default`, `slack-critical`, `slack-warning`
- All severities now route to `#drift-prod-alerts` with appropriate emoji prefixes

---

### 3. Provision and load production secrets

Status: **MOSTLY COMPLETE** (Feb 15). 7/8 secrets provisioned (Postgres RDS, JWT, Encryption, AWS/S3, Firebase, Redis via ElastiCache, Stripe live key). Remaining: APNs keys in Apple Developer portal. `.gitignore` updated to exclude `.env.prod`. Firebase JSON compacted for Docker Compose compatibility.

#### Secrets Scope (First-Cut Production)

**Required for launch (8 items):**

| # | Service | Env Vars | Notes |
|---|---------|----------|-------|
| 1 | Postgres DB | `DATABASE_URL` | Managed DB recommended (RDS, Supabase, etc.) |
| 2 | JWT/Auth | `JWT_SECRET_KEY` | Must be 32+ characters |
| 3 | Encryption | `ENCRYPTION_KEY` | Must be exactly 32 bytes (for AES-256) |
| 4 | Redis | `REDIS_URL` | For rate limiting, caching, sessions |
| 5 | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Get from Stripe Dashboard |
| 6 | AWS/S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | For photo/media uploads |
| 7 | Firebase | `FIREBASE_CREDENTIALS_JSON` | Push notifications (Android + Web) |
| 8 | APNs | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY`, `APNS_BUNDLE_ID` | iOS push notifications |

**Deferred (not needed for first-cut):**

| Service | Env Vars | Why Deferred |
|---------|----------|--------------|
| Jumio | `JUMIO_API_TOKEN`, `JUMIO_API_SECRET`, `JUMIO_WEBHOOK_SECRET` | Can launch with Stripe card check only for age verification |
| Stripe Connect | `STRIPE_CONNECT_WEBHOOK_SECRET` | Creator payouts - add when marketplace goes live |

---

#### Subtasks

3.1 Choose where secrets live
- [x] Decide: `.env.prod` file (simple) vs managed secret store (AWS Secrets Manager, 1Password, etc.). Decision (Feb 14): start with a local `.env.prod` on the prod box, plan to migrate to a managed secrets store once infra stabilizes.
- [x] **Location update (Mar 1)**: `.env.prod` was recreated after accidental loss. **Canonical local path: `/Volumes/dryft-code/.env.prod`** (drive root, outside `Dryft/` project folder). VPS path unchanged: `/opt/dryft/.env.prod`. `docker-compose.prod.yml` updated to `../.env.prod`. All deploy scripts updated to use full absolute path.

3.2 Provision each secret

- [x] **Postgres**: RDS instance `drift-prod-db` provisioned in `us-west-2`, connection string in `.env.prod`. *(Feb 14)*
- [x] **JWT_SECRET_KEY**: Generated and set in `.env.prod` (50 chars). *(Feb 14)*
- [x] **ENCRYPTION_KEY**: Generated and set in `.env.prod` (32 bytes, AES-256 compatible). *(Feb 14)*
- [ ] **Redis**: Currently using Docker service URL (`redis://redis:6379/0`). **Needs managed Redis (ElastiCache or similar) for production.**
- [ ] **Stripe**: Test keys wired (`sk_test_...`). **Needs live keys (`sk_live_...`) + new webhook endpoint before real launch.**
- [x] **AWS/S3**: IAM user `drift-s3-uploader` created, access key + secret in `.env.prod`, bucket `drift-prod-uploads` in `us-west-1`. *(Feb 14)*
- [x] **Firebase**: Admin service account created, full JSON set in `FIREBASE_CREDENTIALS_JSON` in `.env.prod`. JSON compacted to single-line for Docker Compose compatibility. *(Feb 14)*
- [ ] **APNs**: Get key from Apple Developer portal (placeholder values in `.env.prod`)

3.3 Wire secrets into runtime
- [ ] Create `backend/.env.prod` (or configure secret manager)
- [ ] For docker-compose: use `env_file: .env.prod` in `docker-compose.prod.yml`

3.4 Smoke-test app startup
- [x] Boot backend with production-like stack via `docker-compose.prod.yml` and `.env.prod` (ENVIRONMENT=staging, Stripe keys passed through, Jumio disabled for local stack)
- [x] Verify `/health` endpoint returns 200
- [x] Verify `/metrics` endpoint exposes app and Go runtime metrics
- [x] Verify Redis connection from inside container via `/ready` (checks.redis = "ok")
- [x] **Review creators routing for GET/POST**: CLAUDE-Architect fixed routing bug (Feb 12). `GET /v1/creators` was incorrectly mapped to `BecomeCreator`. Removed that route. Now: `GET /featured` and `GET /{creatorID}` are public; `POST /` (become creator) requires auth. No public `/creators` listing endpoint exists - creators are discoverable via `/featured` or by ID.
- [x] **Resolved /v1/store/equipped 404**: The route `/v1/store/equipped` doesn't exist. Correct path is **`GET /v1/inventory/equipped`** (requires auth + verification). Store routes = browsing; inventory routes = user-owned items.

---

### 4. Configure TLS/SSL at the edge

Status: **IN PROGRESS** (Feb 15). TLS is active for `api.dryft.site` on DreamHost using a free Let's Encrypt certificate. Placeholder page loads over HTTPS. Pending Claude-Architect review before first backend deploy to this VPS.

Planned approach (for Claude-Architect review)
- Keep TLS termination and certificate management on DreamHost for `api.dryft.site` (Let’s Encrypt, auto-renew), no custom cert handling in the Dryft repo.
- Run a single Dryft backend instance on the DreamHost VPS, bound to `127.0.0.1:8080`.
- Use DreamHost’s supported proxy configuration so `https://api.dryft.site` reverse-proxies to `http://127.0.0.1:8080`, keeping the backend off the public internet.
- Start without Docker on the VPS: build a Linux binary (or process) from the existing repo on the dev machine, copy it + .env.prod to the VPS, and run under a simple supervisor.
- Optionally revisit Docker on the VPS later if resource limits and DreamHost policies allow it.

#### Claude-Architect Review (Feb 15) — **APPROVED**

**Q1: DreamHost TLS + local HTTP backend on 127.0.0.1:8080?**
Yes, approved. Key requirements: (1) Ensure proxy passes `X-Forwarded-For` and `X-Forwarded-Proto` headers — the rate limiter uses `middleware.RealIP` which reads these. (2) WebSocket upgrade must work through the proxy for the `/ws` path — test this early. (3) Set `ALLOWED_ORIGINS` to `https://dryft.site` before go-live.

**Q2: Defer Docker, start with a single long-lived process?**
No objections. Recommended: cross-compile on dev machine (`GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api`), scp binary + .env.prod to VPS, run under systemd with `Restart=always`.

**Q3: DreamHost VPS hardening?**
- **Firewall**: `ufw allow 22,80,443` — close everything else. Backend on 8080 only reachable via localhost.
- **SSH**: Key-only auth, disable root login, consider non-standard port.
- **Headers**: Backend already sets security headers. Verify DreamHost proxy doesn't strip them.
- **Updates**: Enable `unattended-upgrades`.
- **Monitoring**: Consider `node_exporter` for system metrics.

Subtasks (remaining for HUMAN-Grant):
- [ ] Verify DreamHost proxy passes `X-Forwarded-For` and `X-Forwarded-Proto` headers
- [ ] Test WebSocket upgrade through DreamHost proxy (`wss://api.dryft.site/ws`)
- [ ] Set up `ufw` firewall rules on VPS
- [ ] Disable SSH password auth, enable key-only
- [ ] Cross-compile backend binary and deploy to VPS
- [ ] Create systemd unit file for dryft-api
- [ ] Set `ALLOWED_ORIGINS=https://dryft.site` in `.env.prod`

---

### 5. Deploy Prometheus/Grafana monitoring

Status: Not started (docker-compose.monitoring.yml exists but not deployed to prod).

Subtasks:

5.1 Prepare production monitoring config
- [ ] Review `infra/monitoring/` configs for production readiness.
- [ ] Set persistent storage volumes for Prometheus and Grafana data.

5.2 Deploy monitoring containers
- [ ] Run `docker compose -f docker-compose.monitoring.yml up -d` on prod server.
- [ ] Verify Prometheus can scrape `/metrics` from dryft-api.

5.3 Import/verify Grafana dashboards
- [ ] Access Grafana UI and confirm `dryft.json` dashboard loads.
- [ ] Verify panels show real data (request rate, error rate, latency, WebSocket connections).

5.4 Lock down access
- [ ] Set strong Grafana admin password.
- [ ] Restrict Prometheus/Grafana to internal network or VPN.

---

---

## Phase 2 Task Assignments (CLAUDE-Architect, Mar 1 2026)

> Context: Desktop app is now fully shelled and icons are in place. Mobile TS errors are at 0. Backend is clean. Git repo has been cleaned up (build artifacts + secrets removed/untracked). Next phase focuses on deploying to VPS and first external testing.

---

### 🚨 HUMAN-Grant — Immediate / Security-Critical

**SEC-1**: **Rotate the SSH key committed in commit `e5578a8`**
- [ ] Go to GitHub Settings → SSH and GPG keys → delete the key for `dirty@hazardpaygaming.com`
- [ ] Generate a new ed25519 keypair: `ssh-keygen -t ed25519 -C "your_email" -f ~/.ssh/github_dryft`
- [ ] Add new public key to GitHub
- [ ] Update `~/.ssh/config` to use new key for github.com
- [ ] Delete the old `Dryft/github` and `Dryft/github.pub` files from disk (they are now untracked)
- [ ] Consider using `git filter-repo` or BFG to purge the private key from git history (or accept risk since repo is private)

**SEC-2**: **Clarify `1.env.prod` at volume root**
- [ ] Confirm what `/Volumes/dryft-code/1.env.prod` is — is this a backup of `.env.prod` or a different file?
- [ ] If it contains real secrets, delete or secure it. It is now excluded from git by `.gitignore`.

**SEC-3**: **Commit the cleanup work done by CLAUDE-Architect today**
- [ ] Review `git status` and `git diff` in `/Volumes/dryft-code`
- [ ] Commit: `.gitignore` fixes (SSH key exclusion, typo fix, `1.env.prod` added), `alertmanager.yml` branding fixes (`[DRIFT]`→`[DRYFT]`), untracked files (desktop/out, github keys)
- [ ] Push to GitHub

---

### 🟠 HUMAN-Grant — VPS First Deploy (Next 1-2 weeks)

These are the remaining gates before first external users can hit the backend.

**H1 — APNs Keys** (deadline: whenever iOS push needed for testing)
- [ ] Go to developer.apple.com → Certificates, Identifiers & Profiles → Keys → Create Key (APNs)
- [ ] Download `.p8` file, record Key ID and Team ID
- [ ] Set `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY` (contents of .p8), `APNS_BUNDLE_ID=com.dryft.app` in `/Volumes/dryft-code/.env.prod`
- [ ] Update `/opt/dryft/.env.prod` on VPS once ready

**H2 — Backend VPS Deploy**
- [ ] Cross-compile: `cd Dryft/backend && GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api`
- [ ] SCP binary and `.env.prod` to VPS: `scp dryft-api user@vps:/opt/dryft/` and `scp /Volumes/dryft-code/.env.prod user@vps:/opt/dryft/.env.prod`
- [ ] Copy `infra/dryft-api.service` to `/etc/systemd/system/` on VPS, enable and start
- [ ] Verify DreamHost proxy passes `X-Forwarded-For` and `X-Forwarded-Proto` headers
- [ ] Test: `curl https://api.dryft.site/health` returns 200

**H3 — WebSocket Proxy Test**
- [ ] Test WebSocket upgrade through DreamHost proxy: `wss://api.dryft.site/ws`
- [ ] Use a simple wscat test: `wscat -c "wss://api.dryft.site/ws?token=<test_token>"`

**H4 — VPS Hardening**
- [ ] Set up ufw: `ufw allow 22,80,443 && ufw enable`
- [ ] Disable SSH password auth, enable key-only in `/etc/ssh/sshd_config`
- [ ] Enable `unattended-upgrades`

**H5 — Stripe Live Keys**
- [ ] Go to Stripe Dashboard → swap test keys for live keys
- [ ] Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env.prod`
- [ ] Set webhook endpoint URL to `https://api.dryft.site/v1/webhooks/stripe`

**H6 — Redis Managed**
- [ ] Provision managed Redis (ElastiCache or Redis Cloud free tier)
- [ ] Update `REDIS_URL` in `.env.prod` with new URL

**H7 — Desktop App: First Package Build**
- [ ] `cd Dryft/desktop && npm install && npm run package:mac`
- [ ] Verify DMG installs and app connects to web app (dev or prod)
- [ ] For production: update `NEXT_PUBLIC_API_URL` in web build before packaging

**H8 — Mobile: `npm install` in all workspaces**
- [ ] `cd Dryft/mobile && npm install`
- [ ] `cd Dryft/web && npm install`
- [ ] `cd Dryft/desktop && npm install`
- [ ] Run `npm test` in each to verify suites still pass after install

---

### 🔵 CLAUDE-Architect — Next Tasks

**CA-1**: Review `backend/internal/realtime/hub.go` WebSocket hub for Redis pub/sub routing prep
- Before HPA is enabled, the hub needs to fan-out via Redis. Blocked on H6 (managed Redis).
- When Grant confirms managed Redis is up, CLAUDE-Architect will implement the pub/sub routing layer.

**CA-2**: Write migration test coverage for `internal/database/migrations/`
- All 10 migrations have been reviewed but no automated up/down round-trip tests exist.
- Codex can scaffold the test harness; CLAUDE-Architect reviews dangerous areas.

**CA-3**: Review DreamHost proxy config once H2 deploy is done
- Verify security headers aren't stripped by the proxy layer.
- Verify `X-Forwarded-For` is trusted correctly by the rate limiter.

**CA-4**: Web app — Zustand stores are stubs (`src/store/` exists but store dir exists as placeholder per CLAUDE.md)
- Audit web store stubs and implement or connect to real API — needed before web users can auth.

---

### 🟢 Codex — Next Tasks

**COD-1**: Add `desktop/out/` to `.gitignore` at the desktop level too (belt-and-suspenders)
- Safe area: `desktop/.gitignore`
- Add: `out/`, `dist/`, `release/`

**COD-2**: Add RTL locale support tests for `mobile/src/i18n/`
- Arabic, Hebrew, Farsi, Urdu were added to `SUPPORTED_LANGUAGES` in Feb — add snapshot tests
- Safe area: `mobile/src/__tests__/`

**COD-3**: Add Sentry error boundary integration
- Wire `@sentry/react-native` to `ErrorBoundary.componentDidCatch` in `mobile/src/components/ErrorBoundary.tsx`
- Safe area: component-level Sentry calls only, no auth changes

**COD-4**: Add a `desktop/src/renderer/src/styles.css` dark-mode media query check
- The desktop shell is always dark (hardcoded). Add a CSS `@media (prefers-color-scheme: light)` no-op comment explaining it's intentional.
- Safe area: `desktop/src/renderer/src/styles.css`

---

### Automated Test Suite Status (CLAUDE-Architect, Feb 15)

**Backend**: 29/29 packages passing. Clean.

**Web**: 25/25 test suites passing, 58/58 tests passing.
- Fixed: setup.ts → setup.tsx (JSX in .ts file), vi.mock hoisting (vi.hoisted()), vi globals, require→import for store tests, test data/assertion fixes.

**Mobile**: **46/46 test suites passing, 123/123 tests passing.** Clean.
- Fixed (Feb 14): @sentry/react-native mock, expo-constants mock, missing placeholder.png, i18n locale sync (32 missing keys added to all 8 locales), CreatorScreen assertion, moduleNameMapper for @/ paths.
- Fixed (Feb 15): Root cause identified — `babel-preset-expo` does NOT hoist `jest.mock()` above `import` statements. All 8 remaining failures were caused by mocks being registered after the module-under-test had already loaded its real dependencies. Fix: converted `import` to late `require()` for module-under-test in 8 test files (useCalls, useChatSocket, useDiscoveryFilters, useNotifications, useSafety, authMatchingChatFlow, authMarketplaceFlow, marketplaceStore).

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
- [x] Ensure local secrets files at volume root (`Secrets.rtf`, `1.env.prod`, Firebase JSON, etc.) are not tracked or pushed.

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
- [x] **Location update (Mar 1)**: `.env.prod` was recreated after accidental loss and renamed to `1.env.prod` locally to avoid hidden-file UX in Finder. **Canonical local path: `/Volumes/dryft-code/1.env.prod`** (drive root, outside `Dryft/` project folder). VPS path unchanged: `/opt/dryft/.env.prod`. `docker-compose.prod.yml` updated to `../1.env.prod`. All deploy scripts updated to use full absolute path.

3.2 Provision each secret

- [x] **Postgres**: RDS instance `drift-prod-db` provisioned in `us-west-2`, connection string in `1.env.prod`. *(Feb 14, path updated Mar 1)*
- [x] **JWT_SECRET_KEY**: Generated and set in `1.env.prod` (50 chars). *(Feb 14, path updated Mar 1)*
- [x] **ENCRYPTION_KEY**: Generated and set in `1.env.prod` (32 bytes, AES-256 compatible). *(Feb 14, path updated Mar 1)*
- [ ] **Redis**: Currently using Docker service URL (`redis://redis:6379/0`). **Needs managed Redis (ElastiCache or similar) for production.**
- [ ] **Stripe**: Test keys wired (`sk_test_...`). **Needs live keys (`sk_live_...`) + new webhook endpoint before real launch.**
- [x] **AWS/S3**: IAM user `drift-s3-uploader` created, access key + secret in `1.env.prod`, bucket `drift-prod-uploads` in `us-west-1`. *(Feb 14, path updated Mar 1)*
- [x] **Firebase**: Admin service account created, full JSON set in `FIREBASE_CREDENTIALS_JSON` in `1.env.prod`. JSON compacted to single-line for Docker Compose compatibility. *(Feb 14, path updated Mar 1)*
- [ ] **APNs**: Get key from Apple Developer portal (placeholder values in `1.env.prod`)

3.3 Wire secrets into runtime
- [ ] Create `backend/.env.prod` (or configure secret manager)
- [ ] For docker-compose: use `env_file: 1.env.prod` in `docker-compose.prod.yml`

3.4 Smoke-test app startup
- [x] Boot backend with production-like stack via `docker-compose.prod.yml` and `1.env.prod` (ENVIRONMENT=staging, Stripe keys passed through, Jumio disabled for local stack)
- [x] Verify `/health` endpoint returns 200
- [x] Verify `/metrics` endpoint exposes app and Go runtime metrics
- [x] Verify Redis connection from inside container via `/ready` (checks.redis = "ok")
- [x] **Review creators routing for GET/POST**: CLAUDE-Architect fixed routing bug (Feb 12). `GET /v1/creators` was incorrectly mapped to `BecomeCreator`. Removed that route. Now: `GET /featured` and `GET /{creatorID}` are public; `POST /` (become creator) requires auth. No public `/creators` listing endpoint exists - creators are discoverable via `/featured` or by ID.
- [x] **Resolved /v1/store/equipped 404**: The route `/v1/store/equipped` doesn't exist. Correct path is **`GET /v1/inventory/equipped`** (requires auth + verification). Store routes = browsing; inventory routes = user-owned items.

---

### 4. Configure TLS/SSL at the edge

Status: **IN PROGRESS** (Feb 15). TLS is active for `api.dryft.site` on DreamHost using a free Let's Encrypt certificate. Placeholder page loads over HTTPS. Pending Claude-Architect review...

---

## Phase 2 Task Assignments (CLAUDE-Architect, Mar 1 2026)

> Context: Desktop app is now fully shelled and icons are in place. Mobile TS errors are at 0. Backend is clean. Git repo has been cleaned up (build artifacts + secrets removed/untracked). Next phase focuses on deploying to VPS and first external testing.

---

### HUMAN-Grant — Immediate / Security-Critical

**SEC-1**: ~~**Rotate the SSH key committed in commit `e5578a8`**~~ ✅ COMPLETE (Mar 1)
- [x] Old key revoked in GitHub Settings
- [x] New ed25519 keypair generated and added to GitHub
- [x] `Dryft/github` and `Dryft/github.pub` removed from git index and disk
- [x] SSH key scrubbed from ALL git history via `git filter-repo --path Dryft/github --path Dryft/github.pub --invert-paths`; main force-pushed to GitHub

**SEC-2**: ~~**Clarify `1.env.prod` at volume root**~~ ✅ COMPLETE (Mar 1)
- [x] Confirmed: `/Volumes/dryft-code/1.env.prod` is the canonical prod secrets file (renamed from `.env.prod` to avoid Finder hidden-file UX)
- [x] Excluded from git by `.gitignore`
- [x] Backed up on a separate drive

**SEC-3**: ~~**Commit the cleanup work done by CLAUDE-Architect today**~~ ✅ COMPLETE (Mar 1)
- [x] All changes committed to `main` (`ba2e06f`) and pushed to GitHub
- [x] Worktree branch `claude/objective-matsumoto` committed and pushed; PR opened

---

### HUMAN-Grant — VPS First Deploy (Next 1-2 weeks)

**H1 — APNs Keys** (deadline: whenever iOS push needed for testing)
- [ ] Go to developer.apple.com → Certificates, Identifiers & Profiles → Keys → Create Key (APNs)
- [ ] Download `.p8` file, record Key ID and Team ID
- [ ] Set `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY` (contents of .p8), `APNS_BUNDLE_ID=com.dryft.app` in `/Volumes/dryft-code/1.env.prod`
- [ ] Update `/opt/dryft/.env.prod` on VPS once ready

**H2 — Backend VPS Deploy**
- [ ] Cross-compile: `cd Dryft/backend && GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api`
- [ ] SCP binary and `.env.prod` to VPS: `scp dryft-api user@vps:/opt/dryft/` and `scp /Volumes/dryft-code/1.env.prod user@vps:/opt/dryft/.env.prod`
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
- [ ] Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `1.env.prod`
- [ ] Set webhook endpoint URL to `https://api.dryft.site/v1/webhooks/stripe`

**H6 — Redis Managed**
- [ ] Provision managed Redis (ElastiCache or Redis Cloud free tier)
- [ ] Update `REDIS_URL` in `1.env.prod` with new URL

**H7 — Desktop App: First Package Build**
- [ ] `cd Dryft/desktop && npm install && npm run package:mac`
- [ ] Verify DMG installs and app connects to web app (dev or prod)

**H8 — Mobile: `npm install` in all workspaces**
- [ ] `cd Dryft/mobile && npm install`
- [ ] `cd Dryft/web && npm install`
- [ ] `cd Dryft/desktop && npm install`
- [ ] Run `npm test` in each to verify suites still pass after install

---

### CLAUDE-Architect — Next Tasks

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

### Codex — Next Tasks

**COD-1**: ~~Add `desktop/out/` to `.gitignore` at the desktop level too (belt-and-suspenders)~~ ✅ COMPLETE (Mar 1)
- [x] Added `desktop/.gitignore` with `out/`, `dist/`, and `release/`

**COD-2**: ~~Add RTL locale support tests for `mobile/src/i18n/`~~ ✅ COMPLETE (Mar 1)
- [x] Added RTL locale snapshot test coverage for Arabic, Hebrew, Farsi, and Urdu in `mobile/src/__tests__/i18n.locales.test.ts`

**COD-3**: ~~Add Sentry error boundary integration~~ ✅ COMPLETE (Mar 1)
- [x] Wired Sentry exception capture into `ErrorBoundary.componentDidCatch` via `mobile/src/utils/sentry.ts`

**COD-4**: ~~Add a `desktop/src/renderer/src/styles.css` dark-mode media query check~~ ✅ COMPLETE (Mar 1)
- [x] Added intentional no-op `@media (prefers-color-scheme: light)` note in `desktop/src/renderer/src/styles.css`

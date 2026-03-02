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

Status: **MOSTLY COMPLETE** (Feb 15). 7/8 secrets provisioned (Postgres RDS, JWT, Encryption, AWS/S3, Firebase, Redis via ElastiCache, Stripe live key). `.gitignore` updated to exclude `.env.prod` (now `1.env.prod` locally). Firebase JSON compacted for Docker Compose compatibility.

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
- [x] **Location update (Mar 1)**: `.env.prod` was recreated after accidental loss and renamed to `1.env.prod` locally to avoid hidden-file UX in Finder. **Canonical local path: `/Volumes/dryft-code/1.env.prod`** (drive root, outside `Dryft/` project folder). VPS path for now: `/home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod`.

3.2 Provision each secret

- [x] **Postgres**: ~~RDS (us-west-2)~~ → **Neon** (serverless, free tier). **Budget pivot (Mar 2 2026)**: AWS RDS billing started unexpectedly; all AWS services halted. Replaced with Neon free tier (0.5 GB, auto-suspend, standard wire protocol). Action: sign up at neon.tech, create project + `dryft` DB, run migrations from dev machine (`DATABASE_URL=<neon-url> go run ./cmd/migrate`), update `.env.prod` on VPS with the `*.neon.tech` connection string. See `infra/DREAMHOST_DEPLOYMENT.md` §3a for full setup steps.
- [x] **JWT_SECRET_KEY**: Generated and set in `1.env.prod` (50 chars). *(Feb 14, path updated Mar 1)*
- [x] **ENCRYPTION_KEY**: Generated and set in `1.env.prod` (32 bytes, AES-256 compatible). *(Feb 14, path updated Mar 1)*
- [x] **Redis**: **No managed Redis needed — resolved (Mar 2 2026).** DreamHost VPS cannot install Redis (no root/apt-get), and ElastiCache was halted with other AWS services. Backend already has an in-memory fallback for rate limiting and caching when `REDIS_URL` is unset — confirmed graceful degradation. Decision: leave `REDIS_URL=` empty in `.env.prod` for single-instance VPS deployment. Revisit only if running multiple API replicas (then use Upstash free tier: 10K commands/day, 256 MB).
- [ ] **Stripe**: Test keys wired (`sk_test_...`). **Needs live keys (`sk_live_...`) + new webhook endpoint before real launch.**
- [ ] **Object Storage**: ~~AWS S3 (us-west-1)~~ → **Cloudflare R2** (free tier: 10 GB, $0 egress). **Budget pivot (Mar 2 2026)**: S3 billing halted alongside other AWS services. R2 is S3-compatible — `storage/s3.go` already reads `S3_ENDPOINT`, so zero code changes needed. Action for HUMAN-Grant: (1) Sign up at cloudflare.com → R2 → create bucket `dryft-prod-uploads` → generate API token (R2 Read+Write); (2) update `1.env.prod` and VPS `.env.prod`: `AWS_ACCESS_KEY_ID=<r2-key>`, `AWS_SECRET_ACCESS_KEY=<r2-secret>`, `S3_BUCKET=dryft-prod-uploads`, `S3_REGION=auto`, `S3_ENDPOINT=https://<cf-account-id>.r2.cloudflarestorage.com`. Old AWS IAM user `drift-s3-uploader` and bucket are deactivated.
- [x] **Firebase**: Admin service account created, full JSON set in `FIREBASE_CREDENTIALS_JSON` in `1.env.prod`. JSON compacted to single-line for Docker Compose compatibility. *(Feb 14, path updated Mar 1)*
- [ ] **APNs**: Get key from Apple Developer portal (placeholder values in `1.env.prod`). **Blocked until Apple Developer subscription is renewed (after Mar 28).**

3.3 Wire secrets into runtime
- [ ] Create `backend/.env.prod` (or configure secret manager)
- [ ] For docker-compose: use `env_file: 1.env.prod` in `docker-compose.prod.yml`

3.4 Smoke-test app startup
- [x] Boot backend with production-like stack via `docker-compose.prod.yml` and `1.env.prod` (ENVIRONMENT=staging, Stripe keys passed through, Jumio disabled for local stack)
- [x] Verify `/health` endpoint returns 200 (local)
- [x] Verify `/metrics` endpoint exposes app and Go runtime metrics (local)
- [x] Verify Redis connection from inside container via `/ready` (checks.redis = "ok")
- [ ] **DreamHost VPS**: Next steps — (1) provision Neon DB + run migrations; (2) provision Cloudflare R2 bucket + API token; (3) update VPS `.env.prod` with Neon `DATABASE_URL`, R2 storage vars, empty `REDIS_URL`; (4) run `export DRYFT_VPS_HOST=thedirtyadmin@YOUR_VPS_IP && ./infra/scripts/deploy-vps.sh`; (5) verify `https://api.dryft.site/health` returns 200. *(Previous blocker was `DATABASE_URL` pointing to halted RDS — Neon pivot resolves this.)*

---

### 4. Configure TLS/SSL at the edge

Status: **IN PROGRESS** (Feb 15). TLS is active for `api.dryft.site` on DreamHost using a free Let's Encrypt certificate. Placeholder page loads over HTTPS. Proxy configuration in DreamHost panel has been created to route `api.dryft.site` to the backend once it is healthy.

Planned approach (for Claude-Architect review)
- Keep TLS termination and certificate management on DreamHost for `api.dryft.site` (Let’s Encrypt, auto-renew), no custom cert handling in the Dryft repo.
- Run Dryft backend instance as a user-level process under `thedirtyadmin` on the DreamHost VPS, in `/home/thedirtyadmin/api.dryft.site/opt/dryft`.
- Use DreamHost’s proxy configuration so `https://api.dryft.site` reverse-proxies to the backend port (once confirmed), keeping the backend off the public internet except via the proxy.

#### Claude-Architect Review (Feb 15) — **APPROVED**

**Q1: DreamHost TLS + local HTTP backend on 127.0.0.1:8080?**
Yes, approved. Key requirements: (1) Ensure proxy passes `X-Forwarded-For` and `X-Forwarded-Proto` headers — the rate limiter uses `middleware.RealIP` which reads these. (2) WebSocket upgrade must work through the proxy for the `/ws` path — test this early. (3) Set `ALLOWED_ORIGINS` to `https://dryft.site` before go-live.

**Q2: Defer Docker, start with a single long-lived process?**
No objections. Recommended: cross-compile on dev machine (`GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api`), scp binary + .env.prod to VPS, run as a long-lived user process (pm2, supervisord, or nohup) until system-level control is available.

**Q3: DreamHost VPS hardening?**
- **Firewall**: Configure via DreamHost tools if available; otherwise ensure only 80/443 are exposed and backend port is bound to localhost.
- **SSH**: Key-only auth, disable root login, consider non-standard port.
- **Headers**: Backend already sets security headers. Verify DreamHost proxy doesn't strip them.
- **Updates**: Ensure system packages stay reasonably up-to-date.
- **Monitoring**: Consider `node_exporter` for system metrics when feasible.

Subtasks (remaining for HUMAN-Grant):
- [x] **Switched web server from Apache → Nginx** (PHP 8.x) via DreamHost Panel (Mar 2 2026). Nginx is better for WebSocket proxying (`Upgrade`/`Connection` headers). Takes ~10 min to apply.
- [ ] **After Nginx switch completes**: Re-check Panel proxy target is still `http://127.0.0.1:8080` (the web server switch may reset proxy config in the Panel).
- [ ] Verify DreamHost Nginx proxy passes `X-Forwarded-For` and `X-Forwarded-Proto` headers (critical for rate limiter's `middleware.RealIP`)
- [ ] **WebSocket test** (`wss://api.dryft.site/ws`) — priority with Nginx: if DreamHost's proxy config doesn't include `proxy_set_header Upgrade $http_upgrade` and `proxy_set_header Connection "upgrade"`, WebSockets will silently fail while HTTP works. File a DreamHost support ticket if this fails.
- [x] Decided on final `DATABASE_URL` for VPS: **Neon** (free serverless Postgres). Update `1.env.prod` (local) and VPS `.env.prod` with Neon connection string once provisioned. *(Mar 2 2026, budget pivot)*
- [ ] Re-run `dryft-api` on VPS and confirm `/health` returns 200 via `https://api.dryft.site/health`

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

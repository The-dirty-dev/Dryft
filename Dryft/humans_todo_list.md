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

### 2. Provision and load production secrets

Status: **PARTIALLY COMPLETE, PIVOTED TO NEON + NO REDIS** (Mar 2). Core secrets now point to Neon Postgres; Redis and AWS RDS/Redis are removed from the plan. S3 remains temporarily pointed at AWS but is scheduled to move to Cloudflare R2 free tier.

#### Secrets Scope (First-Cut Production)

**Required for launch (8 items):**

| # | Service | Env Vars | Notes |
|---|---------|----------|-------|
| 1 | Postgres DB | `DATABASE_URL` | Now points to Neon free-tier Postgres (`postgres://neondb_owner:***@ep-...neon.tech/dryft?sslmode=require`) instead of RDS. |
| 2 | JWT/Auth | `JWT_SECRET_KEY` | Must be 32+ characters. |
| 3 | Encryption | `ENCRYPTION_KEY` | Must be exactly 32 bytes (for AES-256). |
| 4 | Redis | `REDIS_URL` | **Pivot:** left empty; backend uses in-memory fallback, no managed Redis needed for single VPS. |
| 5 | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Live keys wired when real payments enabled. |
| 6 | Object Storage | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | **Planned:** migrate from AWS S3 to Cloudflare R2 free tier (S3-compatible) later. |
| 7 | Firebase | `FIREBASE_CREDENTIALS_JSON` | Push notifications (Android + Web). |
| 8 | APNs | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY`, `APNS_BUNDLE_ID` | iOS push notifications (deferred until Apple Developer renewed). |

**Subtasks (updated Mar 2)**

2.1 Choose where secrets live
- [x] Decision: keep canonical env file at `/Volumes/dryft-code/1.env.prod` on Mac; deploy to VPS as `/home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod`. Do not store secrets anywhere in the repo.

2.2 Provision each secret

- [x] **Postgres (Neon)**: Neon project and `dryft` database created; free tier used. `DATABASE_URL` set to Neon connection string (serverless Postgres). RDS is no longer used and all AWS DB resources are shut down.
- [x] **JWT_SECRET_KEY**: Generated and set in `1.env.prod`.
- [x] **ENCRYPTION_KEY**: Generated and set in `1.env.prod` (32 bytes).
- [x] **Redis**: **Pivot:** `REDIS_URL` now empty by design; backend uses in-memory fallback for rate limiting/caching on single VPS.
- [ ] **Object Storage (R2)**: Cloudflare R2 bucket and keys still TODO. For now, existing S3 env vars remain but AWS account is paused; they will be replaced with R2 values (`S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
- [ ] **Stripe**: Live keys to be added closer to launch.
- [x] **Firebase**: Admin service account JSON already set in `FIREBASE_CREDENTIALS_JSON`.
- [ ] **APNs**: Blocked until Apple Developer account is renewed.

2.3 Wire secrets into runtime
- [x] For VPS: `.env.prod` lives at `/home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod`. `dryft-api` is started by exporting vars from this file (`export $(grep -v '^#' .env.prod | grep -v 'FIREBASE_CREDENTIALS_JSON' | grep -v 'APNS_AUTH_KEY' | xargs) && ./dryft-api`).
- [ ] Longer-term: replace ad-hoc export with a small wrapper script or process manager config (pm2/systemd on a future DreamCompute host).

2.4 Smoke-test app startup (updated Mar 2)
- [x] VPS: `./dryft-api` now successfully connects to Neon Postgres, runs migrations 001–010, and remains up.
- [x] Local health: `curl http://localhost:8080/health` on VPS returns 200 JSON with `{"status":"healthy","database":"ok",...}`.
- [x] External health: `curl https://api.dryft.site/health` returns the same JSON via DreamHost Nginx proxy.

---

### 3. Configure TLS/SSL at the edge

Status: **DONE FOR API HEALTH** (Mar 2). `api.dryft.site` uses DreamHost-managed Lets Encrypt TLS, and the proxy now forwards HTTPS traffic to the `dryft-api` process on port 8080.

Subtasks (remaining for HUMAN-Grant):
- [ ] Verify DreamHost proxy sends `X-Forwarded-For` and `X-Forwarded-Proto` headers correctly (rate limiter + RealIP).
- [x] **WebSocket tested through Nginx (Mar 2 2026)**: `wss://api.dryft.site/v1/ws` returns **400 Bad Request** — DreamHost's Nginx strips `Upgrade`/`Connection` headers and downgrades to HTTP/1.0. **Workaround**: WebSocket clients connect directly to `ws://api.dryft.site:8080/v1/ws` (port 8080 is externally accessible, confirmed). REST API continues through `https://api.dryft.site` (TLS proxy). Three code bugs also fixed in this session (auth context key, metrics Hijacker, Timeout middleware wrapping) — commit e9421ed.
- [x] **DreamHost support ticket filed (Mar 2 2026)** requesting Nginx WebSocket headers: `proxy_http_version 1.1;`, `proxy_set_header Upgrade $http_upgrade;`, `proxy_set_header Connection "upgrade";`. 24hr turnaround expected.
- [ ] **After DreamHost Nginx fix**: Re-test `wss://api.dryft.site/v1/ws` — expect 101 Switching Protocols. Once confirmed, update all clients to use `wss://` instead of `ws://:8080`.
- [x] Document the final proxy settings (empty path, port 8080) in DREAMHOST_DEPLOYMENT.md. *(Updated Mar 2 — includes dual-path architecture diagram, WebSocket verification commands, and pending Nginx fix note.)*

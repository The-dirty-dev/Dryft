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
- [x] **DreamHost confirmed (Mar 3 2026)**: Managed VPS Nginx proxy does NOT support custom directives (Upgrade, Connection headers). Will never support WebSocket proxying. **Decision: migrate to DreamCompute.**

---

### 6. DreamCompute Migration

Status: **PLANNING** (Mar 3). DreamHost VPS cannot support WebSocket proxying. DreamCompute provides root-access Ubuntu VMs where we control Nginx directly. This migration replaces the managed VPS with a self-managed DreamCompute instance.

**Context for Perplexity**: DreamHost DreamCompute is OpenStack-based cloud VMs. We need to move from a managed VPS (no root Nginx access) to a DreamCompute instance (full root, systemd, own Nginx). The infra files are already written — this is about provisioning the VM and cutting over.

#### What's already done (by Codex)
- `infra/nginx/api.dryft.site.conf` — production Nginx config with WebSocket upgrade, TLS, security headers
- `infra/dryft-api.service` — systemd unit for `/opt/dryft/dryft-api`
- `infra/scripts/setup-dreamcompute.sh` — idempotent provisioning script (apt, certbot, ufw, systemd)
- `infra/ecosystem.config.js` — pm2 config (fallback/alternative to systemd)

#### Phase 1: Provision DreamCompute VM
- [ ] Log into DreamHost panel → DreamCompute → launch Ubuntu 22.04 instance
- [ ] Pick instance size (start small: $4.50/mo 512MB or $6/mo 1GB — discuss with Perplexity based on Go memory footprint)
- [ ] Assign a public floating IP
- [ ] Set up SSH key access (add your existing pubkey)
- [ ] Update DNS: point `api.dryft.site` A record to the new floating IP
- [ ] Note the old VPS IP so you can revert DNS if needed

#### Phase 2: Run setup script
- [ ] SSH into the new instance as `ubuntu` (or whatever default user DreamCompute provides)
- [ ] Clone the repo (or scp the infra/ directory)
- [ ] Dry-run first: `sudo bash infra/scripts/setup-dreamcompute.sh --dry-run`
- [ ] Review output, then run for real: `sudo bash infra/scripts/setup-dreamcompute.sh`
- [ ] Verify: Nginx running, certbot cert obtained, UFW rules active, `dryft` user created

#### Phase 3: Deploy the binary + env
- [ ] Copy `.env.prod` to `/opt/dryft/.env.prod` on the new instance (update paths if needed)
- [ ] Cross-compile and upload binary: `GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api` then scp to `/opt/dryft/dryft-api`
- [ ] `sudo systemctl start dryft-api && sudo systemctl status dryft-api`
- [ ] Check `journalctl -u dryft-api -f` for clean startup + Neon DB connection
- [ ] Test: `curl -i https://api.dryft.site/health` (should return 200 through your own Nginx + LE cert)

#### Phase 4: Verify WebSocket through Nginx (the whole point)
- [ ] Test: `wscat -c wss://api.dryft.site/v1/ws` — expect 101 Switching Protocols
- [ ] If 101 works: update all client defaults from `ws://api.dryft.site:8080` to `wss://api.dryft.site/v1/ws`
- [ ] Remove port 8080 from UFW (no longer needed — all traffic through Nginx)
- [ ] Celebrate: single-port TLS architecture achieved

#### Phase 5: Decommission old VPS
- [ ] Confirm everything works on DreamCompute for 24-48hrs
- [ ] Cancel / downgrade the DreamHost managed VPS
- [ ] Update `infra/DREAMHOST_DEPLOYMENT.md` and `RUNBOOK.md` with new SSH details and deploy paths

#### Questions for Perplexity
- DreamCompute instance sizing: 512MB vs 1GB for a Go binary + Nginx + certbot? (Go binary uses ~30-50MB at idle)
- DreamCompute networking: is floating IP included or extra cost? Any bandwidth limits?
- DreamCompute storage: boot volume size options? Need enough for binary + logs + certs
- DNS TTL: what should we set before the cutover to minimize downtime?
- Backup strategy: DreamCompute snapshots vs external backups?

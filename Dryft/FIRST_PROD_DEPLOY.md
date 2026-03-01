# First Production Deploy Plan

**Goal**: Get a single Dryft API instance running behind `api.dryft.site` on the DreamHost VPS.
**Approach**: Low-risk, step-by-step, rollback-at-every-stage.
**Explicitly blocked**: APNs keys (Apple Developer portal access needed), App Store configuration (EAS, bundle IDs).

---

## Current State (Feb 15)

| Item | Status |
|---|---|
| TLS on `api.dryft.site` | Active (Let's Encrypt, DreamHost-managed) |
| Backend binary | Builds clean, all 29 test packages pass |
| DB migrations | Reviewed, 009 bug fixed, runner is solid |
| Secrets (`.env.prod`) | 5/8 provisioned (Postgres RDS, JWT, Encryption, AWS/S3, Firebase) |
| Secrets NOT ready | Redis (still Docker URL), Stripe (test keys), APNs (blocked) |
| Alertmanager/Slack | Wired and confirmed |
| Monitoring stack | Scaffolded, not deployed |
| VPS hardening | Not started |

---

## Phase 0: Pre-Flight (Human-Grant, ~30 min)

These are one-time setup steps on the VPS before any code touches it.

- [ ] **0.1** SSH into VPS, confirm OS version (`lsb_release -a` or `cat /etc/os-release`)
- [ ] **0.2** Set up firewall:
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP (redirect to HTTPS)
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw enable
  sudo ufw status verbose
  ```
- [ ] **0.3** Harden SSH:
  ```bash
  sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
  sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
  sudo systemctl restart sshd
  ```
  (Ensure your SSH key is already in `~/.ssh/authorized_keys` before doing this!)
- [ ] **0.4** Enable auto-updates:
  ```bash
  sudo apt update && sudo apt install -y unattended-upgrades
  sudo dpkg-reconfigure -plow unattended-upgrades
  ```
- [ ] **0.5** Create app user and directory:
  ```bash
  sudo useradd -m -s /bin/bash dryft
  sudo mkdir -p /opt/dryft
  sudo chown dryft:dryft /opt/dryft
  ```

**Rollback**: Nothing to roll back; these are safe system hardening steps.

---

## Phase 1: Secrets Finalization (Human-Grant, ~20 min)

Complete the remaining secrets before deploying. APNs is explicitly skipped.

- [ ] **1.1** Provision managed Redis (or confirm DreamHost allows a local Redis process):
  - **Option A (preferred)**: Use AWS ElastiCache — provision a `cache.t4g.micro` in same region as RDS.
  - **Option B (budget)**: Install Redis on the VPS itself: `sudo apt install redis-server`, bind to `127.0.0.1`.
  - Update `REDIS_URL` in `.env.prod` accordingly.
- [ ] **1.2** Decide on Stripe keys for first deploy:
  - For a smoke-test deploy: **test keys are fine** (`sk_test_...`). No real payments.
  - For real launch: switch to live keys later (Section 10 in humans_todo_list).
- [ ] **1.3** Set `ALLOWED_ORIGINS=https://dryft.site` in `.env.prod`
- [ ] **1.4** Set `ENVIRONMENT=staging` in `.env.prod` (keep staging until verified, flip to production later)
- [ ] **1.5** Regenerate `JWT_SECRET_KEY` and `ENCRYPTION_KEY` fresh:
  ```bash
  openssl rand -base64 48  # JWT_SECRET_KEY (64 chars)
  openssl rand -hex 16     # ENCRYPTION_KEY (32 hex = 32 bytes)
  ```
- [ ] **1.6** Leave APNs values as empty strings — the backend gracefully degrades when APNs is unconfigured (iOS push won't work, everything else does).

**Rollback**: Keep a copy of the old `.env.prod` before any edits.

---

## Phase 2: Build & Upload (Human-Grant or Claude-Architect, ~10 min)

Cross-compile the binary on the dev machine and ship it to the VPS.

- [ ] **2.1** Cross-compile on dev machine:
  ```bash
  cd backend
  GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o dryft-api ./cmd/dryft-api
  ```
- [ ] **2.2** Upload to VPS:
  ```bash
  scp dryft-api user@vps:/opt/dryft/dryft-api
  scp /Volumes/dryft-code/.env.prod user@vps:/opt/dryft/.env.prod
  chmod 600 /opt/dryft/.env.prod   # restrict secrets file
  chmod 755 /opt/dryft/dryft-api
  ```
- [ ] **2.3** Verify binary runs:
  ```bash
  ssh user@vps
  cd /opt/dryft
  ./dryft-api -migrate  # Apply all 10 migrations to RDS
  ```
  Expected: "Applied migration 001...010" or "Already at latest version".

**Rollback**: Delete `/opt/dryft/dryft-api` and `/opt/dryft/.env.prod`. No state changed yet.

---

## Phase 3: Run Migrations (Human-Grant, ~5 min)

- [ ] **3.1** Take a pre-migration snapshot of the RDS instance (AWS Console → RDS → Snapshots → Create).
- [ ] **3.2** Run migrations:
  ```bash
  cd /opt/dryft
  ./dryft-api -migrate
  ```
- [ ] **3.3** Verify: connect to RDS and check `schema_migrations`:
  ```bash
  psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version;"
  ```
  Expected: 10 rows, versions 1–10, all `applied = true`.

**Rollback**: Restore the RDS snapshot if anything went wrong. Down migrations exist (`*.down.sql`) but the snapshot is safer.

---

## Phase 4: Systemd Service (Human-Grant, ~10 min)

- [ ] **4.1** Create systemd unit file:
  ```bash
  sudo tee /etc/systemd/system/dryft-api.service << 'EOF'
  [Unit]
  Description=Dryft API Server
  After=network.target

  [Service]
  Type=simple
  User=dryft
  Group=dryft
  WorkingDirectory=/opt/dryft
  EnvironmentFile=/opt/dryft/.env.prod
  ExecStart=/opt/dryft/dryft-api
  Restart=always
  RestartSec=5
  StandardOutput=journal
  StandardError=journal

  # Hardening
  NoNewPrivileges=yes
  ProtectSystem=strict
  ProtectHome=yes
  ReadWritePaths=/opt/dryft

  [Install]
  WantedBy=multi-user.target
  EOF
  ```
- [ ] **4.2** Start the service:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable dryft-api
  sudo systemctl start dryft-api
  sudo systemctl status dryft-api
  ```
- [ ] **4.3** Verify it's listening:
  ```bash
  curl -s http://127.0.0.1:8080/health | jq .
  ```
  Expected: `{"status": "ok"}` or similar.
- [ ] **4.4** Check logs:
  ```bash
  journalctl -u dryft-api -f --no-pager | head -50
  ```

**Rollback**: `sudo systemctl stop dryft-api && sudo systemctl disable dryft-api`

---

## Phase 5: Proxy Verification (Human-Grant, ~15 min)

This is the critical step — making `api.dryft.site` route to the backend.

- [ ] **5.1** Configure DreamHost proxy to forward `api.dryft.site` → `http://127.0.0.1:8080`
  (Use DreamHost panel or `.htaccess` / Apache ProxyPass config, depending on VPS setup)
- [ ] **5.2** Test HTTPS health endpoint from outside:
  ```bash
  curl -s https://api.dryft.site/health | jq .
  ```
  Expected: `{"status": "ok"}`
- [ ] **5.3** Test headers are passing through:
  ```bash
  curl -s -I https://api.dryft.site/health
  ```
  Check for: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] **5.4** Test WebSocket upgrade:
  ```bash
  # Install websocat if needed: cargo install websocat
  websocat "wss://api.dryft.site/ws?token=test" --no-close
  ```
  Expected: Connection establishes (may get auth error in payload, but the upgrade itself should succeed). If the connection is immediately rejected with a non-101 status, the proxy isn't forwarding WebSocket upgrades — fix the proxy config.
- [ ] **5.5** Test CORS:
  ```bash
  curl -s -H "Origin: https://dryft.site" -I https://api.dryft.site/health
  ```
  Check for `Access-Control-Allow-Origin: https://dryft.site`

**Rollback**: Remove proxy config in DreamHost panel. The backend stays running on localhost but is unreachable from outside.

---

## Phase 6: Smoke Test (Human-Grant, ~10 min)

Quick manual verification that core endpoints work through the proxy.

- [ ] **6.1** Health + metrics:
  ```bash
  curl https://api.dryft.site/health
  curl https://api.dryft.site/metrics | head -20
  ```
- [ ] **6.2** Auth flow (register + login):
  ```bash
  # Register
  curl -s -X POST https://api.dryft.site/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"TestPass123!","display_name":"Test User","date_of_birth":"1995-01-15"}' | jq .

  # Login
  curl -s -X POST https://api.dryft.site/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"TestPass123!"}' | jq .
  ```
  Save the `access_token` from login response.
- [ ] **6.3** Authenticated endpoint:
  ```bash
  curl -s https://api.dryft.site/v1/profile \
    -H "Authorization: Bearer <token>" | jq .
  ```
  Expected: Profile data or `VERIFICATION_REQUIRED` (which confirms auth works, age gate is enforced).
- [ ] **6.4** Check Slack:
  Verify no critical alerts fired in `#drift-prod-alerts` during deploy.

**Rollback**: If core endpoints fail, check logs (`journalctl -u dryft-api -f`). Common issues: missing env vars, DB connection refused, Redis unavailable.

---

## Blocked / Deferred Items

| Item | Why Blocked | When to Unblock |
|---|---|---|
| **APNs push (iOS)** | Need Apple Developer portal access for `.p8` key | Before iOS TestFlight |
| **App Store config** | EAS project ID, bundle IDs, Team ID | Before first mobile build |
| **Stripe live keys** | Only needed for real payments | Before public launch |
| **Jumio ID verification** | Deferred; Stripe card check suffices for MVP | When required by regulation |
| **Monitoring deploy** | Prometheus/Grafana not on VPS yet | After backend is stable |
| **DNS for cdn.dryft.site** | Static assets/CDN not set up | When web frontend deploys |
| **Rename DB drift→dryft** | Requires coordinated migration | Low priority, cosmetic |
| **Rename GitHub org** | Go module proxy implications | Low priority, cosmetic |

---

## Post-Deploy Checklist

Once Phase 6 passes:

- [ ] Change `ENVIRONMENT=staging` → `ENVIRONMENT=production` in `.env.prod` and restart
- [ ] Set up a cron job for DB backups: `pg_dump $DATABASE_URL | gzip > /opt/dryft/backups/$(date +%F).sql.gz`
- [ ] Install `node_exporter` for system metrics (optional but recommended)
- [ ] Point web frontend's `NEXT_PUBLIC_API_URL` to `https://api.dryft.site`
- [ ] Run the full E2E testing pass (Section 5 of humans_todo_list)

---

## Deploy Day Quick Reference

```bash
# On dev machine:
cd backend && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o dryft-api ./cmd/dryft-api
scp dryft-api /Volumes/dryft-code/.env.prod user@vps:/opt/dryft/

# On VPS:
cd /opt/dryft
./dryft-api -migrate
sudo systemctl restart dryft-api
curl http://127.0.0.1:8080/health
curl https://api.dryft.site/health
```

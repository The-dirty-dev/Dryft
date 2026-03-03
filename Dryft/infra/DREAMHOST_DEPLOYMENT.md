# DreamHost VPS Deployment Runbook

> **IMPORTANT — Read before following any steps here.**
> DreamHost VPS does **not** provide root access, `apt-get`, `nginx`, `supervisor`, `certbot`,
> or any system-level package installation.
> TLS and reverse-proxy are handled automatically by the **DreamHost Panel**.
> Do **not** follow any generic "nginx + supervisor + root" runbook for this environment.

---

## Architecture

```
Browser / Mobile
      │
      │ HTTPS  (TLS managed by DreamHost Panel + Let's Encrypt)
      ▼
DreamHost Panel Proxy  (api.dryft.site → http://127.0.0.1:8080)
      │
      │ HTTP on loopback
      ▼
dryft-api binary  (runs as thedirtyadmin, managed by pm2 or nohup)
      │
      ├── PostgreSQL → Neon (serverless, managed, free tier)
      ├── Redis     → not used (in-memory fallback built into backend)
      └── Storage   → Cloudflare R2 (S3-compatible, free 10 GB)
```

---

## External Services Required

DreamHost VPS has no root access — Postgres and Redis cannot be installed on it.
Use the following managed free-tier services instead:

| Service | Provider | Cost | Notes |
|---|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | Free | Serverless, standard wire protocol, auto-suspend |
| Redis | *not needed* | $0 | Backend falls back to in-memory when `REDIS_URL` is unset |
| Object storage | [Cloudflare R2](https://cloudflare.com) | Free (10 GB) | S3-compatible, zero egress fees |
| TLS/proxy | DreamHost Panel | Already covered | Auto-renews Let's Encrypt cert |

---

## Prerequisites

| Requirement | Notes |
|---|---|
| SSH access | `ssh thedirtyadmin@YOUR_VPS_IP` |
| Go toolchain (local) | Only needed on your build machine, not the VPS |
| Neon project + DATABASE_URL | Sign up at neon.tech, create project, copy connection string |
| Cloudflare R2 bucket + API token | cloudflare.com → R2 → Create bucket + API token |
| `.env.prod` on VPS | At `~/api.dryft.site/opt/dryft/.env.prod` — **never committed to git** |
| pm2 installed on VPS | `npm install -g pm2` — preferred process manager |
| DreamHost Panel access | To configure the proxy target |

---

## 1. Configure DreamHost Panel Proxy (one-time)

1. Log in to **panel.dreamhost.com**
2. Go to **Websites → Manage Websites**
3. Click **Manage** next to `api.dryft.site`
4. Under **Proxy**, set the proxy target to:
   ```
   http://127.0.0.1:8080
   ```
5. Save. DreamHost will automatically provision a Let's Encrypt certificate for the subdomain.

> The Panel proxy forwards all HTTPS traffic for `api.dryft.site` to port `8080` on `127.0.0.1`.
> The binary just needs to listen on `:8080` — it already does (`Addr: ":" + cfg.Port`).

---

## 2. Set Up Deploy Directory (one-time)

```bash
ssh thedirtyadmin@YOUR_VPS_IP
mkdir -p ~/api.dryft.site/opt/dryft
```

---

## 3. Provision External Services (one-time)

### 3a. Neon (PostgreSQL)

1. Sign up at [neon.tech](https://neon.tech) (free)
2. Create a project → Create a database named `dryft`
3. Copy the connection string — it looks like:
   ```
   postgres://dryft:<password>@<host>.neon.tech/dryft?sslmode=require
   ```
4. Run migrations from your local machine:
   ```bash
   DATABASE_URL="<neon-connection-string>" make migrate
   # or directly:
   DATABASE_URL="<neon-connection-string>" go run ./cmd/migrate
   ```

### 3b. Cloudflare R2 (Object Storage)

1. Sign up at [cloudflare.com](https://cloudflare.com) (free)
2. Go to **R2 → Create bucket** → name it `dryft-prod-uploads`
3. Go to **R2 → Manage API Tokens** → Create token with R2 Read+Write scope
4. Note your **Cloudflare Account ID** from the R2 dashboard URL

No code changes needed — `storage/s3.go` already reads `S3_ENDPOINT` for custom endpoints.

---

## 4. Create `.env.prod` on VPS (one-time, update as needed)

**Edit directly on the VPS** — do not scp from your machine to avoid secrets in shell history or transfer logs:

```bash
ssh thedirtyadmin@YOUR_VPS_IP
nano ~/api.dryft.site/opt/dryft/.env.prod
```

Full `.env.prod` template for this stack:

```dotenv
ENVIRONMENT=production
PORT=8080

# PostgreSQL via Neon (replace with your actual Neon connection string)
DATABASE_URL=postgres://dryft:<password>@<host>.neon.tech/dryft?sslmode=require

# Redis: leave EMPTY — backend uses in-memory fallback (rate limiting, caching)
# Do NOT set this unless you provision managed Redis later (e.g. Upstash free tier)
REDIS_URL=

# Security — binary validates these at startup (ENVIRONMENT=production)
JWT_SECRET_KEY=<at-least-32-random-chars>
ENCRYPTION_KEY=<exactly-32-bytes-hex-or-ascii>

# Stripe (use test keys until ready for live payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare R2 (S3-compatible object storage)
AWS_ACCESS_KEY_ID=<r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<r2-secret-access-key>
S3_BUCKET=dryft-prod-uploads
S3_REGION=auto
S3_ENDPOINT=https://<your-cf-account-id>.r2.cloudflarestorage.com

# Firebase (Android + Web push notifications)
FIREBASE_CREDENTIALS_JSON=<single-line-compacted-json>

# APNs (iOS push) — leave as placeholders until Apple Developer subscription renews
APNS_KEY_ID=placeholder
APNS_TEAM_ID=placeholder
APNS_AUTH_KEY=placeholder
APNS_BUNDLE_ID=com.dryft.app

# CORS
ALLOWED_ORIGINS=https://app.dryft.site,https://dryft.site

# Monitoring
GRAFANA_ADMIN_PASSWORD=<secure-password>
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

> **Critical startup checks** (config.go validates when `ENVIRONMENT=production`):
> - `ENCRYPTION_KEY` must be exactly 32 bytes
> - `JWT_SECRET_KEY` must be ≥ 32 chars
> - `STRIPE_SECRET_KEY` must be set
> Binary exits immediately if any of these are missing.

---

## 5. Build Linux Binary (on your Mac)

Run from the repository root:

```bash
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -ldflags="-s -w" -o dryft-api ./cmd/dryft-api
```

Or use the deploy script (recommended):

```bash
export DRYFT_VPS_HOST=thedirtyadmin@YOUR_VPS_IP
./infra/scripts/deploy-vps.sh
```

---

## 6. Deploy Binary and Restart

### Automated (recommended)

```bash
export DRYFT_VPS_HOST=thedirtyadmin@YOUR_VPS_IP
./infra/scripts/deploy-vps.sh
```

The script cross-compiles, uploads the binary, hot-swaps it, and restarts via pm2.

### Manual steps

```bash
# 1. Cross-compile (on Mac)
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o dryft-api ./cmd/dryft-api

# 2. Upload binary
scp backend/dryft-api thedirtyadmin@YOUR_VPS_IP:~/api.dryft.site/opt/dryft/dryft-api.new

# 3. SSH and hot-swap + restart
ssh thedirtyadmin@YOUR_VPS_IP
cd ~/api.dryft.site/opt/dryft
chmod +x dryft-api.new && mv dryft-api.new dryft-api
pm2 restart dryft-api
```

---

## 7. First-Time Process Setup with pm2

If pm2 is not yet managing `dryft-api`, start it for the first time:

```bash
ssh thedirtyadmin@YOUR_VPS_IP
cd ~/api.dryft.site/opt/dryft

# Option A: ecosystem file (recommended)
# Copy infra/ecosystem.config.js from the repo to this directory, then:
pm2 start ecosystem.config.js

# Option B: inline command
pm2 start dryft-api \
  --name dryft-api \
  --interpreter none \
  --env-file ~/api.dryft.site/opt/dryft/.env.prod \
  --log ~/api.dryft.site/opt/dryft/dryft.log \
  --error ~/api.dryft.site/opt/dryft/dryft-error.log

pm2 save
pm2 startup   # follow printed instructions to enable boot persistence
```

### Fallback: nohup (if pm2 is unavailable)

```bash
ssh thedirtyadmin@YOUR_VPS_IP
cd ~/api.dryft.site/opt/dryft

# Export env vars — binary has NO dotenv loader
set -a; source .env.prod; set +a

# Kill existing process
pkill -f ~/api.dryft.site/opt/dryft/dryft-api || true
sleep 1

# Start in background
nohup ./dryft-api > dryft.log 2>&1 &
echo "Started with PID $!"
```

---

## 8. Post-Deploy Verification

> **After the Apache→Nginx switch**: Before deploying, re-check in the DreamHost Panel that the
> proxy target is still `http://127.0.0.1:8080` — the web server switch may reset proxy config.

```bash
# Health and readiness (from any machine)
curl -fsS https://api.dryft.site/health
curl -fsS https://api.dryft.site/ready

# Metrics endpoint (from VPS loopback only)
curl -fsS http://127.0.0.1:8080/metrics | head -20

# pm2 status
pm2 status dryft-api

# Live logs
pm2 logs dryft-api --lines 50
# or if nohup:
tail -f ~/api.dryft.site/opt/dryft/dryft.log
```

### WebSocket verification (Nginx-specific)

DreamHost's Nginx proxy must forward WebSocket upgrade headers. Test with:

```bash
# Install wscat if needed: npm install -g wscat
wscat -c wss://api.dryft.site/v1/ws
```

If the connection is immediately rejected (not a 401/403 auth error, but a protocol error),
DreamHost's Nginx config is missing the WebSocket proxy headers. File a support ticket asking
them to add to the proxy config for `api.dryft.site`:
```
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

## 9. Rollback

```bash
ssh thedirtyadmin@YOUR_VPS_IP
cd ~/api.dryft.site/opt/dryft

# deploy-vps.sh keeps previous binary as dryft-api.prev
mv dryft-api dryft-api.bad
mv dryft-api.prev dryft-api
pm2 restart dryft-api
```

---

## 10. Monitoring Stack

The monitoring stack (Prometheus, Loki, Grafana, Alertmanager, node_exporter) runs via Docker Compose on the VPS:

```bash
docker compose -f docker-compose.monitoring.yml up -d

# View Grafana locally via SSH tunnel
ssh -L 3001:127.0.0.1:3001 thedirtyadmin@YOUR_VPS_IP
# Then open http://localhost:3001 in your browser
```

Prometheus scrapes the Go API at `host.docker.internal:8080` (Docker→host bridge).
Promtail ships `~/api.dryft.site/opt/dryft/dryft.log` to Loki.

---

## 11. Environment Notes

| Tool | Available on DreamHost VPS? | How we handle it |
|---|---|---|
| nginx | ✅ **Active web server** (switched from Apache, Mar 2 2026) | DreamHost manages config — no direct `/etc/nginx` access; Panel proxy sets reverse-proxy target. Better WebSocket support than Apache. |
| Apache | ➡️ Replaced by Nginx | See above |
| supervisor | ❌ Not available | pm2 (or nohup) instead |
| certbot / Let's Encrypt | ❌ No access | DreamHost Panel handles TLS automatically |
| systemd unit files | ❌ User systemd not supported | pm2 startup hook instead |
| apt-get / package installs | ❌ No root access | All dependencies via managed services (Neon, R2) |
| Docker | ✅ Available | Used for monitoring stack only |
| pm2 | ✅ Install via npm | Primary process manager |
| PostgreSQL install | ❌ Not available (VPS, not dedicated) | Neon free tier |
| Redis install | ❌ Not available (VPS, not dedicated) | In-memory fallback (already built in) |

> `infra/dryft-api.service` is kept for reference and future server migrations
> (e.g., EC2/DigitalOcean with full systemd). It is **not used** on DreamHost VPS.

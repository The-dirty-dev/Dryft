# Dryft Backend Runbook

This runbook covers day-to-day operations for `dryft-api` on DreamCompute.

## 1) Service Start/Stop/Restart

```bash
sudo systemctl status dryft-api
sudo systemctl start dryft-api
sudo systemctl stop dryft-api
sudo systemctl restart dryft-api
sudo systemctl daemon-reload
```

Follow logs:

```bash
sudo journalctl -u dryft-api -f
sudo journalctl -u dryft-api --since "15 min ago"
```

## 2) Health Check

```bash
curl -sS https://api.dryft.site/health | jq
```

Expected top-level fields:
- `status`: `healthy` when app is ready.
- `database`: `ok` when Neon connectivity works.
- `timestamp`: backend UTC time.
- `version` / `uptime` (if present): runtime metadata.

## 3) Database (Neon)

Neon console:
- [Neon Console](https://console.neon.tech)

Connection string format:

```text
postgres://<user>:<password>@<host>/<db>?sslmode=require
```

Manual migration run (from backend source tree):

```bash
cd /opt/dryft-repo/backend
go test ./internal/database -run TestMigrate -count=1
```

## 4) Deployment

Build:

```bash
cd /opt/dryft-repo/backend
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o dryft-api ./cmd/dryft-api
```

Install binary + restart:

```bash
sudo cp /opt/dryft-repo/backend/dryft-api /opt/dryft/dryft-api
sudo chown dryft:dryft /opt/dryft/dryft-api
sudo chmod 755 /opt/dryft/dryft-api
sudo systemctl restart dryft-api
```

Rollback using previous binary:

```bash
sudo cp /opt/dryft/dryft-api.prev /opt/dryft/dryft-api
sudo chown dryft:dryft /opt/dryft/dryft-api
sudo systemctl restart dryft-api
```

## 5) Monitoring

Log patterns to watch:
- `level=ERROR`
- `level=WARN`
- `panic:`

Quick checks:

```bash
sudo journalctl -u dryft-api --since "30 min ago" | rg "ERROR|WARN|panic"
curl -sS http://127.0.0.1:8080/metrics | head
```

## 6) Secrets Rotation

Edit env file:

```bash
sudo vi /opt/dryft/.env.prod
```

Rotate `JWT_SECRET_KEY`:
1. Deploy code that can verify both old/new keys if zero-downtime token continuity is required.
2. Update env value.
3. Restart service.
4. Monitor 401 rate for regression.

Rotate `ENCRYPTION_KEY`:
1. Deploy dual-read logic before cutover (old+new key support).
2. Rotate env value.
3. Restart service.
4. Re-encrypt data in background if key wrapping is used.

## 7) Common Operations

Clear in-memory rate limiter/cache:

```bash
sudo systemctl restart dryft-api
```

Check active WebSocket connections (estimate via logs):

```bash
sudo journalctl -u dryft-api --since "10 min ago" | rg "ws|websocket|client connected|client disconnected"
```

Check TLS certificate expiry:

```bash
sudo openssl x509 -in /etc/letsencrypt/live/api.dryft.site/fullchain.pem -noout -enddate
sudo systemctl status certbot.timer
```

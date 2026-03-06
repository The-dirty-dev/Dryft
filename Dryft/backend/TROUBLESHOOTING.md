# Dryft Backend Troubleshooting

Use this as Problem -> Cause -> Fix during incidents.

## 1) Health endpoint returns unhealthy

Problem:
- `curl https://api.dryft.site/health` reports unhealthy or DB failure.

Likely cause:
- Neon DB unavailable, wrong `DATABASE_URL`, DNS/network issue.

Fix:
```bash
sudo systemctl status dryft-api
sudo journalctl -u dryft-api --since "15 min ago" | tail -200
grep "^DATABASE_URL=" /opt/dryft/.env.prod
nslookup api.dryft.site
```
Validate Neon credentials in `.env.prod`, then restart:
```bash
sudo systemctl restart dryft-api
```

## 2) 401 on all requests

Problem:
- Every authenticated endpoint returns 401.

Likely cause:
- `JWT_SECRET_KEY` mismatch across instances, expired tokens, missing `Authorization` header.

Fix:
```bash
grep "^JWT_SECRET_KEY=" /opt/dryft/.env.prod
sudo journalctl -u dryft-api --since "15 min ago" | rg "jwt|token|401"
```
Confirm clients send `Authorization: Bearer <token>`.

## 3) WebSocket 400 Bad Request

Problem:
- `/v1/ws` returns 400 at proxy layer.

Likely cause:
- Nginx not forwarding WebSocket upgrade headers.

Fix:
Verify Nginx config includes:
- `proxy_http_version 1.1;`
- `proxy_set_header Upgrade $http_upgrade;`
- `proxy_set_header Connection "upgrade";`

Then:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4) WebSocket 401 Unauthorized

Problem:
- `/v1/ws` returns 401 after upgrade path reaches backend.

Likely cause:
- Missing/invalid `?token=` query parameter.

Fix:
- Ensure client connects with token:
  - `wss://api.dryft.site/v1/ws?token=<jwt>`
- Confirm token validity and signing key.

## 5) Redis connection failed

Problem:
- Startup logs show Redis connection warnings.

Likely cause:
- `REDIS_URL` intentionally empty for in-memory fallback.

Fix:
- No action required for single-node deployment.
- Confirm fallback log message and normal request handling.

## 6) Migration failed

Problem:
- Service fails during migrations.

Likely cause:
- SQL syntax issue, migration ordering issue, or DB role lacks `CREATE/ALTER`.

Fix:
```bash
sudo journalctl -u dryft-api --since "30 min ago" | rg "migration|migrate|ERROR"
```
Check latest files under `backend/internal/database/migrations/` and Neon user permissions.

## 7) Binary will not start

Problem:
- `dryft-api.service` exits immediately.

Likely cause:
- Wrong binary architecture, missing execute bit, or port conflict.

Fix:
```bash
file /opt/dryft/dryft-api
ls -l /opt/dryft/dryft-api
sudo ss -ltnp | rg ":8080"
```
Expected target: `linux/amd64`. Rebuild and redeploy if mismatch.

## 8) TLS cert expired

Problem:
- HTTPS fails due certificate expiry.

Likely cause:
- Certbot renewal failed or timer disabled.

Fix:
```bash
sudo certbot renew
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status certbot.timer
```

## 9) High memory usage

Problem:
- API memory keeps growing or OOM risk.

Likely cause:
- Abnormal WebSocket connection growth, goroutine leak, traffic spike.

Fix:
```bash
sudo journalctl -u dryft-api --since "20 min ago" | rg "websocket|connected|disconnected"
curl -sS http://127.0.0.1:8080/metrics | rg "go_goroutines|process_resident_memory_bytes"
```
If needed, restart service to stabilize, then inspect recent deploy diff for realtime/hub changes.

See also: `RUNBOOK.md`.

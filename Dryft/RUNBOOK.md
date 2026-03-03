# Dryft Operations Runbook

This runbook covers common production issues and how to respond.

Primary production endpoints:
- Web app: `https://dryft.site`
- API: `https://api.dryft.site`
- WebSocket: `wss://api.dryft.site/v1/ws`

## 1. High Error Rate (>1%)

1. Check recent deploys and rollback if errors correlate with release time.
2. Inspect API logs for the top failing endpoints and status codes.
3. Verify downstream dependencies (Postgres, Redis, Stripe, Firebase).
4. If errors are isolated to a feature, disable that feature via config/flags if available.

## 2. High Latency (p99 > 500ms)

1. Identify slow endpoints using metrics dashboards.
2. Check database health and slow queries.
3. Verify Redis connectivity; missing cache can increase latency.
4. Scale API instances or increase DB resources if saturation is observed.

## 3. Database Issues

**Connection failures**
1. Verify `DATABASE_URL` and DB availability.
2. Check connection pool limits and open connections.
3. Confirm disk space and IOPS on the DB volume.

**Migration failures**
1. Halt deploy.
2. Roll back the last migration if possible.
3. Restore from backup if data corruption is suspected.

## 4. Redis Failures

1. Confirm Redis is reachable and auth is correct (if enabled).
2. The backend falls back to in-memory rate limiting if Redis is down.
3. Expect reduced cache hit rate and higher DB load.

## 5. WebSocket Disconnects

1. Confirm `wss://api.dryft.site/v1/ws` is reachable and TLS is terminating correctly.
2. Verify the user is verified (WebSocket requires verification).
3. Check `ALLOWED_ORIGINS` for web clients.
4. Ensure load balancer supports WebSocket upgrades and idle timeouts.

## 6. Push Notification Failures

1. Confirm Firebase/APNs credentials are valid.
2. Verify device registration endpoints are receiving tokens.
3. Check push provider dashboards for delivery errors.

## 7. Media Upload Failures

1. Confirm AWS credentials and S3 bucket policy.
2. Verify signed URL expiration is reasonable.
3. Check for CORS rules on S3 if uploads are from web clients.

## 8. Rollback Procedure

1. Identify the last known good release tag.
2. Re-deploy with that image tag.
3. If migrations are incompatible, run the rollback migration or restore from backup.
4. Validate `https://api.dryft.site/health` and core flows after rollback.

## 9. Contact Escalation

- **On-call**: [On-call contact]
- **Backend**: [Backend owner]
- **Infra**: [Infra owner]
- **Security**: [Security contact]

## 10. CI Troubleshooting

1. `npm ci` fails due to lockfile mismatch: regenerate `package-lock.json` in the affected package.
2. `ENOTEMPTY` or stale `node_modules`: delete the folder and re-run `npm ci`.
3. Missing secrets cause skipped jobs: set `CODECOV_TOKEN`, `SNYK_TOKEN`, `EXPO_TOKEN`, and `VERCEL_*` as needed.
4. Codecov upload errors: confirm token is valid or repo is public.
5. Playwright install failures: verify network access and cache `~/.cache/ms-playwright`.
6. Integration E2E failures: check `docker-compose.prod.yml` env vars and `/health` response.

## 11. 2026-03-02 Production API + R2 Migration Notes

**Scope:** Bring `https://api.dryft.site` back online on DreamHost VPS, point verification uploads to Cloudflare R2, and re-enable WebSocket auth flow (in progress).

**Key changes today:**

- DreamHost domain config for `api.dryft.site`:
  - Switched from Apache to Nginx with proxy to `127.0.0.1:8080` (no path prefix).
  - Confirmed via `curl -v https://api.dryft.site/health` returning `server: nginx/1.28.0` and JSON health payload.
- Backend process on VPS:
  - Binary path: `/home/thedirtyadmin/api.dryft.site/opt/dryft/dryft-api`.
  - Env file: `/home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod`.
  - Typical restart sequence:
    - `cd /home/thedirtyadmin/api.dryft.site/opt/dryft`
    - `export $(grep -v '^#' .env.prod | grep -v 'FIREBASE_CREDENTIALS_JSON' | grep -v 'APNS_AUTH_KEY' | xargs)`
    - `./dryft-api > dryft-api.log 2>&1 &` then `disown`.
  - If `listen tcp :8080: bind: address already in use` appears, kill the previous `dryft-api` process and restart.
- Cloudflare R2 migration for verification photos:
  - Created R2 bucket: `dryft-prod-uploads`.
  - API token with `Object Read & Write`, scoped to that bucket only.
  - S3 client config in `.env.prod`:
    - `S3_BUCKET=dryft-prod-uploads`
    - `S3_REGION=auto`
    - `S3_ENDPOINT=https://57577b933fe98c33856627ae11afa6af.r2.cloudflarestorage.com`
    - `AWS_ACCESS_KEY_ID=<R2 access key>`
    - `AWS_SECRET_ACCESS_KEY=<R2 secret key>`
  - On startup, logs show: `S3 client initialized` with `bucket=dryft-prod-uploads region=auto`.
- Redis:
  - ElastiCache endpoint currently unreachable from DreamHost.
  - Startup logs show repeated connection failures followed by: `Redis unreachable, falling back to in-memory rate limiter`.
  - Behavior: rate limiting works in-process; expect no Redis-backed caching until endpoint/network is fixed.
- Auth + test user:
  - Created prod user via `POST /v1/auth/register`:
    - Email: `grant@freimont.com`.
  - Marked `verified = true` directly in Neon `users` table.
  - Login endpoint `POST /v1/auth/login` returns `tokens.access_token` and `tokens.refresh_token` as expected.
- WebSocket status:
  - Endpoint: `wss://api.dryft.site/v1/ws`.
  - Auth methods supported in code:
    - `Authorization: Bearer <JWT>` header via auth middleware.
    - `?token=<JWT>` query param fallback for browser clients.
  - Current behavior (post-2026-03-02 deploy):
    - HTTP health and login are good.
    - WebSocket handshake using a valid access token via `wscat` currently returns 400 (earlier 401).
  - Next actions (assigned to Claude, 2026-03-02 afternoon):
    - Instrument WS auth path with detailed logging for all 400/401/403 returns.
    - Ensure `OptionalAuth` + context key usage allow verified JWTs from `/v1/auth/login` to upgrade successfully.
    - Confirm behavior end-to-end from mobile/web clients once handler fixes are deployed.

**How to rebuild and deploy backend from Mac:**

- Local code checkout path: `/Volumes/dryft-code/Dryft/backend`.
- Build Linux binary:
  - `cd /Volumes/dryft-code/Dryft/backend`
  - `GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api`
- Upload to VPS (preferred via SFTP client like ForkLift):
  - Connect to `thedirtyadmin@vps40055.dreamhostps.com`.
  - Remote path: `/home/thedirtyadmin/api.dryft.site/opt/dryft/dryft-api` (overwrite existing file).
  - On VPS: `chmod +x dryft-api` if needed, then restart as described above.

**Quick verification checklist after deploy:**

1. `curl -v https://api.dryft.site/health` → HTTP 200, JSON with `"status":"healthy"` and `"database":"ok"`.
2. `curl -s -X POST https://api.dryft.site/v1/auth/login ...` → returns non-null `tokens.access_token`.
3. R2 logs show no errors creating verification photo objects (when clients exercise that path).
4. WebSocket `wss://api.dryft.site/v1/ws` upgrade succeeds for a verified user once handler fixes are deployed.

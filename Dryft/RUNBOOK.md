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

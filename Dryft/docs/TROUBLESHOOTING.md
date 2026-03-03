# Dryft Troubleshooting

Common issues and fixes across the Dryft stack.

## Backend Build Failures

**Symptom:** `go test` or `go run` fails.

- Verify Go version is **1.22+**.
- Run from `backend/` and ensure module dependencies are downloaded.
- If you see missing stdlib errors, reinstall Go and reset build cache:
  - `go env GOROOT` should point to a valid Go install.

## Database Connection Issues

**Symptom:** `database connection failed` or `pq: connection refused`.

- Confirm `DATABASE_URL` is correct.
- Ensure Postgres is running and reachable.
- Check firewall/port rules (default 5432).

## Redis Connection Issues

**Symptom:** warnings about Redis or rate limiter fallback.

- Verify `REDIS_URL` if you expect Redis to be used.
- Redis is optional; the backend falls back to an in-memory limiter if absent.

## Auth / Unauthorized Errors

**Symptom:** `401` from protected endpoints.

- Ensure you pass `Authorization: Bearer <access_token>`.
- If using WebSocket in a browser, include `?token=<JWT>`.

## WebSocket Disconnects

**Symptom:** Socket connects then closes or errors.

- Confirm the user is **verified** (verification required for `/v1/ws`).
- In production, ensure `ALLOWED_ORIGINS` includes the web domain.
- Check network proxies allow WebSocket upgrades.

## WebSocket 400 "Bad Request" in Production

**Symptom:** `wss://api.dryft.site/v1/ws` returns 400, but `ws://api.dryft.site:8080/v1/ws` works.

This is caused by DreamHost's Nginx proxy stripping `Upgrade` and `Connection` headers before forwarding to the Go backend. The Go app receives `Upgrade=""` and `Connection="close"` instead of the WebSocket upgrade headers.

**Diagnosis:** Check the Go logs for:
```
[WS] upgrade headers: Upgrade="" Connection="close"
[WS] Upgrade FAILED: websocket: the client is not using the websocket protocol
```

**Workaround:** Connect WebSocket clients directly to port 8080 (bypasses Nginx):
- Native clients (VR/mobile): `ws://api.dryft.site:8080/v1/ws`
- REST API still uses: `https://api.dryft.site` (through Nginx with TLS)

**Permanent fix:** DreamHost must add to their Nginx proxy config:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## WebSocket 500 "Internal Server Error"

**Symptom:** WebSocket returns 500 and logs show `response does not implement http.Hijacker`.

This happens when middleware wraps the `http.ResponseWriter` with a type that doesn't implement `http.Hijacker`, which gorilla/websocket needs to take over the TCP connection.

**Known culprits:**
- Chi's `middleware.Timeout` — wraps with `timeoutWriter` (no Hijacker). Fixed by `skipForWebSocket()` wrapper in `main.go`.
- Custom `metrics.Middleware` — wraps with `responseWriter`. Fixed by adding `Hijack()` method in `metrics.go`.

## Web Build Failures

**Symptom:** Next.js build fails or missing env vars.

- Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` as needed.
- If using web push, ensure Firebase keys and VAPID key are configured.

## Mobile Metro / Expo Issues

**Symptom:** Metro bundler hangs or cache errors.

```bash
npx expo start --clear
```

If iOS/Android builds fail, clean native builds:

```bash
cd ios && pod install && cd ..
cd android && ./gradlew clean && cd ..
```

## Push Notifications (Web)

**Symptom:** No notifications in browser.

- Confirm `web/public/firebase-messaging-sw.js` is registered.
- Web push requires HTTPS (or localhost in dev).
- Ensure `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set.

## E2E Tests (Playwright)

**Symptom:** Playwright tests fail to start.

- Ensure Playwright dependency is installed in `web/`.
- Confirm the web app and backend are running and reachable.

## CI Coverage Failures

**Symptom:** Coverage jobs fail in CI.

- Web: `@vitest/coverage-v8` must be installed for Vitest coverage.
- Mobile: Jest requires `--experimental-vm-modules` for dynamic imports in some tests.

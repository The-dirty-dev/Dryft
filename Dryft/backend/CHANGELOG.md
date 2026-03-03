# Dryft Backend API Changelog

All notable API changes should be documented in this file.

## Unreleased

### Fixed — 2026-03-02 (WebSocket production fixes)

- **WebSocket 401 bug**: Fixed context key type mismatch in auth middleware — `userIDKey` was a bare string but middleware stored values under a typed `contextKey`, so `GetUserID()` always returned empty. Unified on the typed key.
- **WebSocket 500 (`http.Hijacker`)**: Custom `responseWriter` in `metrics/metrics.go` embedded `http.ResponseWriter` but did not implement `http.Hijacker`. Added `Hijack()` delegation method so gorilla/websocket can take over the TCP connection.
- **WebSocket 500 (Timeout middleware)**: Chi's `middleware.Timeout` wraps the writer with `timeoutWriter` which also lacks `Hijacker`. Added `skipForWebSocket()` helper in `main.go` that bypasses the Timeout middleware for WebSocket upgrade requests.
- **Auth middleware**: Changed `/v1/ws` route from `RequireAuth` to `OptionalAuth` so the WebSocket handler can accept both middleware-injected context and `?token=` query param auth (needed for browser clients).
- Added debug logging to auth middleware and WebSocket handler for connection troubleshooting.

## 2026-02-09

- Initial documented v1 API surface (auth, users, profile, discovery, matches, chat, notifications, calls, haptics, sessions, store, inventory, creators, verification, analytics, safety, settings, avatar, links, subscriptions, admin).

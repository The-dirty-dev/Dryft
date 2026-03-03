# Changelog

All notable changes to Drift will be documented in this file.

## [Unreleased]

### Fixed — 2026-03-02

- **WebSocket production deployment**: Fixed three cascading bugs preventing WebSocket connections (auth context key mismatch, missing `http.Hijacker` on metrics response writer, Timeout middleware wrapping). WebSocket now works end-to-end.
- **Known limitation**: DreamHost's Nginx proxy strips WebSocket `Upgrade`/`Connection` headers. Support ticket submitted. Workaround: WebSocket clients connect directly to port 8080 (`ws://api.dryft.site:8080/v1/ws`) while REST API uses the TLS proxy (`https://api.dryft.site`).

## [1.0.0] - 2026-02-11 (planned)

### Added

- Backend REST API v1 covering auth, profiles, matching, chat, calls, sessions, haptics, marketplace, safety, and verification.
- Realtime WebSocket hub for chat, presence, calls, and session events.
- Mobile app (Expo) with discovery, chat, calls, companion sessions, and safety tooling.
- Web app (Next.js) for browser-based access and desktop embedding.
- Desktop app (Electron) with auto-updates, deep links, and haptic integrations.
- VR client (Unity) for Quest and PC VR experiences.
- Documentation for environment setup, troubleshooting, runbook operations, API versioning, onboarding, deep links, and VR integration.

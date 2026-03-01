# Dryft

<!-- Replace REPO_OWNER/REPO_NAME with the GitHub org/repo slug once the remote is configured. -->
[![CI](https://github.com/REPO_OWNER/REPO_NAME/actions/workflows/ci.yml/badge.svg)](https://github.com/REPO_OWNER/REPO_NAME/actions/workflows/ci.yml)
[![CodeQL](https://github.com/REPO_OWNER/REPO_NAME/actions/workflows/codeql.yml/badge.svg)](https://github.com/REPO_OWNER/REPO_NAME/actions/workflows/codeql.yml)
[![Nightly](https://github.com/REPO_OWNER/REPO_NAME/actions/workflows/nightly.yml/badge.svg)](https://github.com/REPO_OWNER/REPO_NAME/actions/workflows/nightly.yml)
[![Coverage](https://codecov.io/gh/REPO_OWNER/REPO_NAME/branch/main/graph/badge.svg)](https://codecov.io/gh/REPO_OWNER/REPO_NAME)
[![License](https://img.shields.io/badge/License-Proprietary-lightgrey.svg)](backend/README.md#license)

Dryft is a VR-first dating platform with companion mobile and web experiences, realtime chat and calls, and haptic-enabled sessions.

## Repository Layout

- `backend/` - Go API server, realtime WebSocket hub, and services
- `web/` - Next.js web app and embedded desktop UI surface
- `mobile/` - React Native (Expo) companion app
- `desktop/` - Electron desktop wrapper with native integrations
- `vr-dryft/` - Unity VR client
- `shared/` - Shared types and contracts

## Quick Start (Dev)

1. Review required environment variables in `docs/ENVIRONMENT.md`.
2. Start the API in `backend/` (see `backend/README.md`).
3. Start clients as needed:
Web: `web/README.md`.
Mobile: `mobile/README.md`.
Desktop: `desktop/README.md`.
VR: `vr-dryft/README.md`.

## Documentation

- Release notes: `RELEASE_NOTES.md`
- Changelog: `CHANGELOG.md`
- Support: `SUPPORT.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Operations: `RUNBOOK.md`
- Launch checklist: `LAUNCH_CHECKLIST.md`

## License

Proprietary - Dryft Inc.

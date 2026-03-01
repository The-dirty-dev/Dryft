# API Versioning Strategy

Dryft's API is versioned in the URL path (e.g., `/v1`). This document describes how versions evolve and how breaking changes are handled.

## Versioning Model

- **Current version**: `v1`
- **Path prefix**: `/v1/...`
- **Breaking changes** require a new version (`/v2`) or explicit deprecation period.

## Backward Compatibility

We aim to preserve backward compatibility within a major version:

- Additive changes (new fields/endpoints) are allowed.
- Breaking changes (removals or behavior changes) require a new version.

## Deprecation Policy

1. Announce deprecation in `backend/CHANGELOG.md`.
2. Provide a migration window (target: 90 days) before removal.
3. Add headers or warnings where possible in responses.

## Breaking Change Process

1. Propose change and document it in `backend/CHANGELOG.md`.
2. Implement change under a new version prefix.
3. Update client apps to use the new version.
4. Sunset the old version after the deprecation window.

## Client Expectations

- Clients should treat unknown fields as optional.
- Clients should not assume array ordering unless documented.
- Time values are Unix epoch milliseconds unless otherwise noted.

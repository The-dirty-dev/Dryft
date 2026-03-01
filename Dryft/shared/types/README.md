# Shared Types

This package contains shared TypeScript types that define Dryft’s API contracts and cross‑platform data models. The goal is to keep web, mobile, and backend‑aligned clients in lockstep.

## Purpose

- Centralize API request/response types.
- Avoid duplicated type definitions across web and mobile.
- Make contract changes explicit and reviewable.

## How Web/Mobile Consume It

The package name is `@drift/shared-types` and exports are defined in `shared/types/src/index.ts`.

Common consumption patterns in this repo:

- Workspace dependency import (preferred once wired):
  - `import { User, AuthTokens } from '@drift/shared-types';`
- Direct monorepo path import (when workspace aliasing isn’t set up):
  - `import { User, AuthTokens } from '../../shared/types/src';`

Use whichever is already configured in the app’s TypeScript setup and bundler. If neither is set up yet, add the dependency/alias before switching imports.

## Adding New Types

1. Add or update the type in `shared/types/src/index.ts`.
2. Export it from the module’s root (this file).
3. Update any app usage to import from the shared package instead of local types.

## Conventions

- All API contract types live here (request/response payloads, enums, and shared models).
- Keep names consistent with backend JSON fields (snake_case keys stay snake_case).
- Prefer small, composable interfaces so mobile/web can extend without forking.

## Notes

This package is private and intended for internal Dryft apps only.

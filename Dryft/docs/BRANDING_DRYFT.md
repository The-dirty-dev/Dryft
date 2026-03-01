# Dryft Branding Guide

## Identity

| Field | Value |
|---|---|
| **Product Name** | Dryft |
| **Tagline** | Connection Beyond Boundaries |
| **Domain** | dryft.site |
| **API Domain** | api.dryft.site |
| **CDN Domain** | cdn.dryft.site |
| **Email Domain** | @dryft.site |
| **Deep Link Scheme** | `dryft://` |
| **iOS Bundle ID** | `com.dryft.app` |
| **Android Package** | `com.dryft.app` |
| **Desktop App ID** | `app.dryft.desktop` |
| **Apple Merchant ID** | `merchant.com.dryft.app` |
| **Expo Owner** | `dryft` |

## Color Palette

| Role | Hex | Usage |
|---|---|---|
| Primary | `#8B5CF6` | Buttons, links, active elements |
| Background | `#0a0a0a` | App background (dark mode) |
| Surface | `#0f0f23` | Cards, modals, desktop window |
| Accent | `#A78BFA` | Highlights, hover states |
| Error | `#EF4444` | Validation errors, destructive actions |
| Success | `#10B65A` | Confirmations, online status |

## Tone of Voice

- **Warm and inclusive.** Never clinical or corporate.
- **Safety-first.** Verification and moderation language should reassure, not threaten.
- **Playful but respectful.** Dating is personal; copy should never be dismissive.
- First person plural ("we") when speaking as the platform.
- Second person ("you") when addressing users.

## Naming Rules

### External Copy (user-facing)
- Always **Dryft** (capital D, no article).
- "Welcome to Dryft" not "Welcome to the Dryft app".
- Emails from `noreply@dryft.site`, `safety@dryft.site`, `support@dryft.site`.

### Internal Code
- Package names use lowercase: `dryft-web`, `dryft-mobile`, `dryft-desktop`, `dryft-api`.
- Go module: `github.com/dryft-app/backend`.
- npm scope: `@dryft/shared-types`.
- Storage keys: `dryft_tokens`, `dryft_token`, `dryft-auth`.
- Event namespaces: `dryft:api-error`.
- Docker images: `dryft-backend`, `dryft-api`.

### What Stays Unchanged
- **Directory names** have been renamed (`vr-dryft/`, `cmd/dryft-api/`) as of Feb 27, 2026.
- **Git history** is never rewritten for branding.
- **Third-party package names** are never modified.
- **Lock files** (`package-lock.json`, `go.sum`) regenerate naturally.

## Rebrand Migration Status (Feb 15, 2026)

### Completed
- [x] All `package.json` files (root, web, mobile, desktop, shared/types)
- [x] Go module path and all Go import paths (49 files)
- [x] `backend/Makefile`, `backend/Dockerfile` binary names
- [x] `mobile/app.json` (name, slug, scheme, bundle IDs, permissions text, deep links)
- [x] Backend config defaults (`config.go`, `.env.example`)
- [x] Web API client storage keys and error events
- [x] Desktop app ID, tray label, update URL, user model ID
- [x] Mobile deep linking, navigation, services (callKeep, voipPush, gifts, appRating, appUpdate, ShareSheet)
- [x] Web and mobile UI strings (brand name in pages, components, notifications)
- [x] Backend notification templates, Jumio User-Agent, OpenAPI spec
- [x] All i18n locale files (en, es, fr, de, ja, pt, it, ko, zh-CN)
- [x] Infrastructure configs (docker-compose, k8s, terraform, monitoring, CI workflows)
- [x] All documentation files (README, CLAUDE.md, legal docs, infra docs)
- [x] VR/Unity C# namespaces and brand strings
- [x] Test files (email addresses, storage key refs)

### Follow-Up Tasks (Require Human Action)
- [ ] Register `dryft` Expo owner account and update EAS project ID
- [ ] Create App Store / Play Store listings under new name
- [ ] Provision `dryft.site` DNS records (A/CNAME for apex, api, cdn subdomains)
- [ ] Configure DreamHost VPS for `dryft.site` and `api.dryft.site`
- [ ] Update Apple Developer bundle ID to `com.dryft.app`
- [ ] Update Apple Pay merchant ID to `merchant.com.dryft.app`
- [ ] Provision new S3 bucket `dryft-uploads` (or `dryft-prod-uploads`)
- [ ] Update SES verified sender to `noreply@dryft.site`
- [ ] Update Stripe webhook endpoints to `api.dryft.site`
- [ ] Update Jumio callback URLs to `api.dryft.site`
- [ ] Rename GitHub org/repo from `drift-app` to `dryft-app` (or update Go module proxy)
- [ ] Rename PostgreSQL database/user from `drift` to `dryft` in production
- [ ] Update Firebase project settings for new bundle ID
- [x] Rename directory `vr-drift/` to `vr-dryft/` (coordinate with Unity project settings) — **DONE** (Feb 27)
- [ ] Regenerate `package-lock.json` files after all package.json changes

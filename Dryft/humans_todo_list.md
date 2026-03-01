# Human TODO List

This file tracks human-executable deployment and ops tasks for Dryft.
It is also the coordination point between HUMAN-Grant, CLAUDE-Architect, and Perplexity.
- HUMAN-Grant: works through concrete, bite-sized steps and records decisions.
- CLAUDE-Architect: reviews infra/architecture changes, validates approaches, and handles dangerous-area edits.
- Perplexity: helps decompose tasks, update this file, and guide step-by-step execution without touching dangerous code paths.

## Production Readiness Tasks

1. Wire Alertmanager to Slack/PagerDuty. *(Slack wired and verified; PagerDuty deferred pending budget, Alertmanager tuning optional later.)*
2. Provision and load production secrets.
3. Configure TLS/SSL at the edge.
4. Deploy Prometheus/Grafana monitoring.
5. Run manual end-to-end testing pass.

---

### 1. Wire Alertmanager to Slack/PagerDuty

Status: **DONE** (Feb 14). Slack alerts confirmed working in `#drift-prod-alerts`. PagerDuty deferred.

Subtasks (completed / remaining):

1.1 Decide provider and channel
- [x] Choose providers (Slack now, PagerDuty later when budget allows).
- [x] Create `#drift-prod-alerts` Slack channel.

1.2 Create webhook / integration
- [x] Slack: create incoming webhook for `#drift-prod-alerts` and configure URL in `alertmanager.yml`.
- [ ] PagerDuty: create Events API v2 integration on "Dryft Production" service and wire into Alertmanager (deferred until closer to live prod).

1.3 Locate Alertmanager config in the repo
- [x] Open `infra/monitoring/alertmanager.yml` and confirm `route` and `receivers` sections exist.

1.4 Add or update receivers
- [x] Add `slack-critical` receiver with Slack webhook URL and message template.
- [ ] Add `pagerduty-critical` receiver with integration key (deferred).

1.5 Wire alerts to the receivers
- [x] Add `routes` entry matching `severity="critical"` and send to `slack-critical`.

1.6 Restart/reload Alertmanager
- [x] Use `docker compose -f docker-compose.monitoring.yml restart alertmanager` to apply config.
- [x] Investigate and resolve Alertmanager restart loop — **FIXED by CLAUDE-Architect** (missing `default` receiver, bad matcher syntax).

1.7 Send and confirm a test alert
- [x] Add `DriftTestCriticalAlert` (always-firing vector(1) with `severity: critical`) in `infra/monitoring/alerts.yml`.
- [x] Restart Alertmanager and confirm Slack receives `DriftTestCriticalAlert` — **Confirmed working (Feb 14)**.
- [x] Check `#drift-prod-alerts` Slack channel for test alert notification — **Confirmed (Feb 14)**.
- [x] Decision: **Keep** `DriftTestCriticalAlert` in `infra/monitoring/alerts.yml` for future smoke testing.

---

### 2. Auth response shape mismatch (frontend vs backend)

Status: **DONE** (CLAUDE-Architect, Feb 13; human-verified Feb 14)

- [x] Backend returns nested `tokens` object
- [x] `localStorage` confirmed to have correct shape
- [x] Protected endpoint returns 403 `VERIFICATION_REQUIRED` (auth works, age gate enforced)

#### Alertmanager Fix Summary (CLAUDE-Architect, Feb 11)

**Root cause**: The config referenced `receiver: default` but no `default` receiver was defined.

**Changes made to `infra/monitoring/alertmanager.yml`**:
- Added `global` section with `resolve_timeout: 5m`
- Fixed matcher syntax (removed outer quotes)
- Added three receivers: `default`, `slack-critical`, `slack-warning`
- All severities now route to `#drift-prod-alerts` with appropriate emoji prefixes

---

### 2. Provision and load production secrets

Status: **MOSTLY COMPLETE** (Feb 15). 7/8 secrets provisioned (Postgres RDS, JWT, Encryption, AWS/S3, Firebase, Redis via ElastiCache, Stripe live key). Remaining: APNs keys in Apple Developer portal. `.gitignore` updated to exclude `.env.prod`. Firebase JSON compacted for Docker Compose compatibility.

#### Secrets Scope (First-Cut Production)

**Required for launch (8 items):**

| # | Service | Env Vars | Notes |
|---|---------|----------|-------|
| 1 | Postgres DB | `DATABASE_URL` | Managed DB recommended (RDS, Supabase, etc.) |
| 2 | JWT/Auth | `JWT_SECRET_KEY` | Must be 32+ characters |
| 3 | Encryption | `ENCRYPTION_KEY` | Must be exactly 32 bytes (for AES-256) |
| 4 | Redis | `REDIS_URL` | For rate limiting, caching, sessions |
| 5 | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Get from Stripe Dashboard |
| 6 | AWS/S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | For photo/media uploads |
| 7 | Firebase | `FIREBASE_CREDENTIALS_JSON` | Push notifications (Android + Web) |
| 8 | APNs | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY`, `APNS_BUNDLE_ID` | iOS push notifications |

**Deferred (not needed for first-cut):**

| Service | Env Vars | Why Deferred |
|---------|----------|--------------|
| Jumio | `JUMIO_API_TOKEN`, `JUMIO_API_SECRET`, `JUMIO_WEBHOOK_SECRET` | Can launch with Stripe card check only for age verification |
| Stripe Connect | `STRIPE_CONNECT_WEBHOOK_SECRET` | Creator payouts - add when marketplace goes live |

---

#### Subtasks

2.1 Choose where secrets live
- [x] Decide: `.env.prod` file (simple) vs managed secret store (AWS Secrets Manager, 1Password, etc.). Decision (Feb 14): start with a local `.env.prod` on the prod box, plan to migrate to a managed secrets store once infra stabilizes.
- [x] **Location update (Mar 1)**: `.env.prod` was recreated after accidental loss. **Canonical local path: `/Volumes/dryft-code/.env.prod`** (drive root, outside `Dryft/` project folder). VPS path unchanged: `/opt/dryft/.env.prod`. `docker-compose.prod.yml` updated to `../.env.prod`. All deploy scripts updated to use full absolute path.

2.2 Provision each secret

- [x] **Postgres**: RDS instance `drift-prod-db` provisioned in `us-west-2`, connection string in `.env.prod`. *(Feb 14)*
- [x] **JWT_SECRET_KEY**: Generated and set in `.env.prod` (50 chars). *(Feb 14)*
- [x] **ENCRYPTION_KEY**: Generated and set in `.env.prod` (32 bytes, AES-256 compatible). *(Feb 14)*
- [ ] **Redis**: Currently using Docker service URL (`redis://redis:6379/0`). **Needs managed Redis (ElastiCache or similar) for production.**
- [ ] **Stripe**: Test keys wired (`sk_test_...`). **Needs live keys (`sk_live_...`) + new webhook endpoint before real launch.**
- [x] **AWS/S3**: IAM user `drift-s3-uploader` created, access key + secret in `.env.prod`, bucket `drift-prod-uploads` in `us-west-1`. *(Feb 14)*
- [x] **Firebase**: Admin service account created, full JSON set in `FIREBASE_CREDENTIALS_JSON` in `.env.prod`. JSON compacted to single-line for Docker Compose compatibility. *(Feb 14)*
- [ ] **APNs**: Get key from Apple Developer portal (placeholder values in `.env.prod`)

2.3 Wire secrets into runtime
- [ ] Create `backend/.env.prod` (or configure secret manager)
- [ ] For docker-compose: use `env_file: .env.prod` in `docker-compose.prod.yml`

2.4 Smoke-test app startup
- [x] Boot backend with production-like stack via `docker-compose.prod.yml` and `.env.prod` (ENVIRONMENT=staging, Stripe keys passed through, Jumio disabled for local stack)
- [x] Verify `/health` endpoint returns 200
- [x] Verify `/metrics` endpoint exposes app and Go runtime metrics
- [x] Verify Redis connection from inside container via `/ready` (checks.redis = "ok")
- [x] **Review creators routing for GET/POST**: CLAUDE-Architect fixed routing bug (Feb 12). `GET /v1/creators` was incorrectly mapped to `BecomeCreator`. Removed that route. Now: `GET /featured` and `GET /{creatorID}` are public; `POST /` (become creator) requires auth. No public `/creators` listing endpoint exists - creators are discoverable via `/featured` or by ID.
- [x] **Resolved /v1/store/equipped 404**: The route `/v1/store/equipped` doesn't exist. Correct path is **`GET /v1/inventory/equipped`** (requires auth + verification). Store routes = browsing; inventory routes = user-owned items.

---

### 3. Configure TLS/SSL at the edge

Status: **IN PROGRESS** (Feb 15). TLS is active for `api.dryft.site` on DreamHost using a free Let's Encrypt certificate. Placeholder page loads over HTTPS. Pending Claude-Architect review before first backend deploy to this VPS.

Planned approach (for Claude-Architect review)
- Keep TLS termination and certificate management on DreamHost for `api.dryft.site` (Let’s Encrypt, auto-renew), no custom cert handling in the Dryft repo.
- Run a single Dryft backend instance on the DreamHost VPS, bound to `127.0.0.1:8080`.
- Use DreamHost’s supported proxy configuration so `https://api.dryft.site` reverse-proxies to `http://127.0.0.1:8080`, keeping the backend off the public internet.
- Start without Docker on the VPS: build a Linux binary (or process) from the existing repo on the dev machine, copy it + .env.prod to the VPS, and run under a simple supervisor.
- Optionally revisit Docker on the VPS later if resource limits and DreamHost policies allow it.

#### Claude-Architect Review (Feb 15) — **APPROVED**

**Q1: DreamHost TLS + local HTTP backend on 127.0.0.1:8080?**
Yes, approved. Key requirements: (1) Ensure proxy passes `X-Forwarded-For` and `X-Forwarded-Proto` headers — the rate limiter uses `middleware.RealIP` which reads these. (2) WebSocket upgrade must work through the proxy for the `/ws` path — test this early. (3) Set `ALLOWED_ORIGINS` to `https://dryft.site` before go-live.

**Q2: Defer Docker, start with a single long-lived process?**
No objections. Recommended: cross-compile on dev machine (`GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api`), scp binary + .env.prod to VPS, run under systemd with `Restart=always`.

**Q3: DreamHost VPS hardening?**
- **Firewall**: `ufw allow 22,80,443` — close everything else. Backend on 8080 only reachable via localhost.
- **SSH**: Key-only auth, disable root login, consider non-standard port.
- **Headers**: Backend already sets security headers. Verify DreamHost proxy doesn't strip them.
- **Updates**: Enable `unattended-upgrades`.
- **Monitoring**: Consider `node_exporter` for system metrics.

Subtasks (remaining for HUMAN-Grant):
- [ ] Verify DreamHost proxy passes `X-Forwarded-For` and `X-Forwarded-Proto` headers
- [ ] Test WebSocket upgrade through DreamHost proxy (`wss://api.dryft.site/ws`)
- [ ] Set up `ufw` firewall rules on VPS
- [ ] Disable SSH password auth, enable key-only
- [ ] Cross-compile backend binary and deploy to VPS
- [ ] Create systemd unit file for dryft-api
- [ ] Set `ALLOWED_ORIGINS=https://dryft.site` in `.env.prod`

Status: Not started (docker-compose.monitoring.yml exists but not deployed to prod).

Subtasks:

4.1 Prepare production monitoring config
- [ ] Review `infra/monitoring/` configs for production readiness.
- [ ] Set persistent storage volumes for Prometheus and Grafana data.

4.2 Deploy monitoring containers
- [ ] Run `docker compose -f docker-compose.monitoring.yml up -d` on prod server.
- [ ] Verify Prometheus can scrape `/metrics` from dryft-api.

4.3 Import/verify Grafana dashboards
- [ ] Access Grafana UI and confirm `dryft.json` dashboard loads.
- [ ] Verify panels show real data (request rate, error rate, latency, WebSocket connections).

4.4 Lock down access
- [ ] Set strong Grafana admin password.
- [ ] Restrict Prometheus/Grafana to internal network or VPN.

---

### Automated Test Suite Status (CLAUDE-Architect, Feb 15)

**Backend**: 29/29 packages passing. Clean.

**Web**: 25/25 test suites passing, 58/58 tests passing.
- Fixed: setup.ts → setup.tsx (JSX in .ts file), vi.mock hoisting (vi.hoisted()), vi globals, require→import for store tests, test data/assertion fixes.

**Mobile**: **46/46 test suites passing, 123/123 tests passing.** Clean.
- Fixed (Feb 14): @sentry/react-native mock, expo-constants mock, missing placeholder.png, i18n locale sync (32 missing keys added to all 8 locales), CreatorScreen assertion, moduleNameMapper for @/ paths.
- Fixed (Feb 15): Root cause identified — `babel-preset-expo` does NOT hoist `jest.mock()` above `import` statements. All 8 remaining failures were caused by mocks being registered after the module-under-test had already loaded its real dependencies. Fix: converted `import` to late `require()` for module-under-test in 8 test files (useCalls, useChatSocket, useDiscoveryFilters, useNotifications, useSafety, authMatchingChatFlow, authMarketplaceFlow, marketplaceStore).

---

### Security Audit & Infrastructure Hardening (CLAUDE-Architect, Feb 15)

**Security fixes applied:**
- [x] **bcrypt cost for token hashing**: Changed from `bcrypt.MinCost` (4) to `bcrypt.DefaultCost` (10) in `auth/service.go`. Passwords were already using DefaultCost.
- [x] **Security headers middleware**: Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` to all API responses in `main.go`.
- [x] **Monitoring ports locked to localhost**: Prometheus (9090), Alertmanager (9093), Loki (3100), Grafana (3001) now bound to `127.0.0.1` only — not exposed to public internet.
- [x] **Grafana anonymous access disabled**: Requires login with `GRAFANA_ADMIN_PASSWORD` env var.
- [x] **Nginx Permissions-Policy fixed**: Changed `camera=(), microphone=()` to `camera=(self), microphone=(self)` — needed for video calls.
- [x] **CI migration-check fixed**: Was using `golang-migrate` (wrong file naming convention). Now uses the actual custom runner (`go run ./cmd/dryft-api -migrate`).
- [x] **docker-compose.prod.yml**: Added `env_file: .env.prod` and made `DATABASE_URL` respect the env file (was hardcoded to Docker postgres, overriding the RDS URL).
- [x] **Confirmed `.env.prod` never committed to git**: `git log --all --full-history -- .env.prod` returns empty.

**Audit findings (no action needed):**
- SQL queries use parameterized `$1, $2` — no injection risk
- No `dangerouslySetInnerHTML` usage — no XSS risk
- No hardcoded secrets in source code
- Auth middleware is fail-closed (errors = deny access)
- Default JWT secret only applies in dev mode; production validation enforces 32+ chars

**Known trade-offs (documented, not fixing now):**
- Web stores JWT in localStorage (standard for SPAs; httpOnly cookies would require backend changes). CSP headers in nginx provide mitigation.
- `ALLOWED_ORIGINS` still set to localhost — needs human to decide production domain (listed in Section 10 tasks).

---

### Kubernetes Hardening (CLAUDE-Architect, Feb 15)

**Fixes applied:**
- [x] **Security contexts added**: All 3 workloads (api-deployment, redis-deployment, postgres-statefulset) now have `runAsNonRoot`, `allowPrivilegeEscalation: false`, `capabilities.drop: ALL`. API also has `readOnlyRootFilesystem`.
- [x] **Health checks added**: Redis (`redis-cli ping`) and Postgres (`pg_isready`) now have both liveness and readiness probes. API probes gained `timeoutSeconds: 5`.
- [x] **Image pull policy**: API deployment changed from `IfNotPresent` to `Always`.
- [x] **Prometheus annotations**: Added `prometheus.io/scrape`, `/port`, `/path` to API pod template.
- [x] **NetworkPolicy created**: 3 policies — API allows ingress on 8080 + egress to Postgres/Redis/HTTPS/DNS only; Postgres and Redis restricted to ingress from API pods only.
- [x] **PDB for Postgres**: Added `maxUnavailable: 0` PDB to prevent accidental eviction during maintenance.
- [x] **HPA improvements**: Max replicas 6→10, added `behavior` field with 300s stabilization window for scale-down (prevents flapping), scale-up allows 2 pods per 60s.
- [x] **Kustomization updated**: Added `network-policy.yaml` to resource list.
- [x] **PGDATA env var**: Added `PGDATA=/var/lib/postgresql/data/pgdata` to Postgres to avoid lost+found conflicts.

**Remaining (human decision needed):**
- [ ] Pin API image tag to specific version (e.g., `dryft-backend:v1.0.0`) — currently `:latest`
- [ ] Replace `api.dryft.example.com` in `ingress.yaml` with real production domain
- [ ] Set up cert-manager or provision TLS secret `dryft-api-tls` referenced by ingress

---

### Terraform Hardening (CLAUDE-Architect, Feb 15)

**Fixes applied:**
- [x] **Security groups created**: 3 SGs — API (ingress 8080 from VPC), Postgres (ingress 5432 from API SG only), Redis (ingress 6379 from API SG only). Least-privilege network segmentation.
- [x] **RDS hardened**: Added `storage_encrypted = true`, `multi_az` (enabled in production), `deletion_protection` (production), `skip_final_snapshot = false` (production creates final snapshot), `performance_insights_enabled`, backup window, maintenance window, backup retention 14 days in production.
- [x] **ElastiCache hardened**: Pinned engine version `7.0`, added security group reference.
- [x] **S3 hardened**: Added versioning, AES256 server-side encryption, public access block (all 4 settings enabled).
- [x] **ECS cluster**: Added Container Insights monitoring.
- [x] **Default tags**: Added `Project`, `Environment`, `ManagedBy` tags to all resources via provider default_tags.
- [x] **Sensitive outputs**: Marked `postgres_endpoint` and `redis_endpoint` as sensitive.
- [x] **Variables**: Added `db_instance_class` and `redis_node_type` variables (were hardcoded), marked `db_username` as sensitive.
- [x] **Remote state backend**: Added S3+DynamoDB backend config (commented out — human needs to create S3 bucket and DynamoDB table first, then uncomment).

**Remaining (human decision/action needed):**
- [ ] Create S3 bucket `dryft-terraform-state` and DynamoDB table `dryft-terraform-locks` for remote state, then uncomment backend block in `versions.tf`
- [ ] Upgrade `db_instance_class` from `db.t4g.micro` for production workload
- [ ] Upgrade `redis_node_type` from `cache.t4g.micro` for production workload
- [ ] Consider NAT Gateway for private subnet outbound access (ECS tasks in private subnets)

---

### TypeScript Fixes (CLAUDE-Architect, Feb 15)

**Fixes applied:**
- [x] `mobile/src/store/verificationStore.ts` — Added `VerificationApiResponse` type, fixed optional chaining, removed invalid 3rd arg, cast VerificationType/VerificationStatus. 0 TS errors remaining.
- [x] `mobile/src/types/index.ts` — Added local `import type` for types used within the file (were only re-exported, not locally available).
- [x] `mobile/src/components/index.ts` — Fixed barrel exports: changed `export { default as X }` to `export * from './X'` for 15 components that use named exports.
- [x] `mobile/src/components/accessible/index.tsx` — Fixed style type issues (empty string not valid style, Pressable callback return type).
- [x] `mobile/src/components/AccessibleComponents.tsx` — Fixed `role` type conflict, `forwardRef` generic type.
- [x] `mobile/src/components/common/Avatar.tsx` — Fixed `ViewStyle` vs `ImageStyle` for expo-image.
- [x] `mobile/src/components/InAppNotification.tsx` — Fixed falsy string style issue.

**Remaining**: ~421 pre-existing TS errors across 57 service/hook files (mostly `response.data` nullable access patterns). These are type safety issues, not runtime bugs — the code works but isn't strictly typed. Large refactoring effort, deferred.

---

### 5. Run manual end-to-end testing pass

Status: Not started.

Subtasks (from LAUNCH_CHECKLIST.md):

5.1 Core Features
- [ ] User registration
- [ ] User login
- [ ] Profile creation
- [ ] Photo upload
- [ ] Matching/swiping
- [ ] Chat messaging
- [ ] Video calls
- [ ] Push notifications
- [ ] In-app purchases
- [ ] Account deletion

5.2 Couples Features
- [ ] Couple linking/pairing
- [ ] Relationship timeline
- [ ] Activities completion
- [ ] Quizzes
- [ ] Milestones
- [ ] Memories upload

5.3 Gamification
- [ ] Daily rewards claiming
- [ ] Streak tracking
- [ ] Achievement unlocking
- [ ] Season pass progression
- [ ] Tier reward claiming

5.4 Monetization
- [ ] Couples Premium subscription
- [ ] Season pass purchase
- [ ] Creator tipping
- [ ] Subscription cancellation

5.5 Safety & Moderation
- [ ] Content reporting
- [ ] AI moderation triggers
- [ ] Scam detection alerts
- [ ] Admin moderation queue

---

### 6. App Store Configuration

Status: Not started.

6.1 Get EAS Project ID
- [ ] Run `cd mobile && npx eas login` (login to Expo).
- [ ] Run `npx eas init` to create/link project.
- [ ] Copy project ID from output or expo.dev dashboard.
- [ ] Update `mobile/app.json` with `projectId` in `extra.eas` and `updates.url`.

6.2 Configure Google Maps API Keys
- [ ] Go to Google Cloud Console → Create project (or use existing).
- [ ] Enable "Maps SDK for iOS" and "Maps SDK for Android".
- [ ] Create API credentials (API Key).
- [ ] Restrict the key to your app's bundle ID.
- [ ] Update `mobile/app.json` with iOS and Android keys.

6.3 Configure Apple App Store (iOS)
- [ ] Get Apple Developer Team ID from developer.apple.com → Membership.
- [ ] Create app in App Store Connect and get numeric App ID (`ascAppId`).
- [ ] Update `mobile/eas.json` with `appleId`, `ascAppId`, and `appleTeamId`.

6.4 Configure Google Play Store (Android)
- [ ] Create app in Google Play Console.
- [ ] Go to Setup → API Access → Create service account.
- [ ] Download JSON key file.
- [ ] Save as `mobile/google-service-account.json`.

---

### 7. Database Migrations (Production)

Status: **REVIEW COMPLETE** (CLAUDE-Architect, Feb 14). One critical bug fixed. Ready to apply.

#### Migration Review Results (CLAUDE-Architect, Feb 14)

**Critical bug fixed:**
- `009_companion_sessions.sql` had `-- +goose Down` directives and `DROP TABLE` statements embedded in the up migration. Our custom runner (`migrate.go`) doesn't parse goose directives — it executes the entire file. This would have **created tables then immediately dropped them**. Fixed by removing the embedded down migration (the separate `009_companion_sessions.down.sql` file already existed).

**Migration runner assessment:**
- Custom runner in `internal/database/migrate.go` — tracks applied versions in `schema_migrations` table, runs each migration in a transaction, skips already-applied ones. **Solid design.**
- Idempotency is handled at the runner level (skip if already in `schema_migrations`), not in individual SQL files. This is fine for normal operation.
- Migrations 004-007 use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` (defensive).
- Migrations 001-003, 008, 010 use plain `CREATE TABLE` / `CREATE INDEX` (will error if run outside the runner). Not a problem since we'll use the runner.

**Schema review — all 10 migrations look production-ready:**
- 001: Users, verification_attempts, matches, vr_sessions + indexes + triggers
- 002: Swipes, conversations, messages + auto-update last_message_at trigger
- 003: Marketplace (creators, items, purchases, inventory, reviews, payouts) + full-text search
- 004: Push devices, notification history, extended user profile fields
- 005: Call history with computed duration, ICE server config
- 006: VoIP push devices (iOS APNs)
- 007: Admin dashboard (actions audit log, user reports, admin roles)
- 008: Haptic devices, permissions, command log, patterns
- 009: Companion sessions (VR cross-platform), participants, session chat
- 010: Account deletion requests with expiring tokens

**No issues found with:** foreign keys, cascades, constraints, indexes, or data types.

Subtasks:

7.1 Review migrations
- [x] Review all SQL files for production readiness — **DONE** (CLAUDE-Architect, Feb 14).
- [x] Fix critical bug in 009 (embedded down migration) — **DONE**.
- [x] Verify idempotency — handled by migration runner's `schema_migrations` tracking.

7.2 Take pre-migration backup
- [ ] Run `pg_dump` of production database before applying migrations.

7.3 Apply migrations
- [ ] **IMPORTANT**: Do NOT run migrations manually with `psql -f`. Use the built-in migration runner:
  ```bash
  # Option A: Via the API binary's -migrate flag
  ./dryft-api -migrate

  # Option B: Via make (from backend/ directory)
  make migrate

  # Option C: Via Docker (if running in container)
  docker exec dryft-api ./dryft-api -migrate
  ```
  The runner tracks applied migrations in `schema_migrations` and runs each in a transaction. Safe to re-run.

7.4 Verify schema
- [ ] Spot-check that tables, indexes, and constraints are as expected.
- [ ] Verify `schema_migrations` table shows all 10 versions applied.

---

### 8. Sentry Error Monitoring Setup

Status: Not started.

Subtasks:

8.1 Create Sentry project
- [ ] Go to sentry.io and create account (if needed).
- [ ] Create new project → React Native.
- [ ] Copy the DSN.

8.2 Configure mobile app
- [ ] Add DSN to `mobile/.env`: `EXPO_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx`
- [ ] Verify Sentry SDK is wired in mobile app code.

8.3 Test error capture
- [ ] Trigger a test error in the app.
- [ ] Confirm it appears in Sentry dashboard.

---

### 9. Backups & Disaster Recovery

Status: Not started.

Subtasks:

9.1 Set up automated backups
- [ ] Configure `pg_dump` cron job or managed backup service.
- [ ] Store backups in separate location (S3, different region, etc.).

9.2 Test restore procedure
- [ ] Restore a backup to a test database.
- [ ] Verify data integrity.

9.3 Document rollback plan
- [ ] Document previous Docker image tags for quick rollback.
- [ ] Document migration rollback steps (`.down.sql` files).

---

### 10. Pre-Launch Security Hardening (Human-Only)

Status: Not started. **All items require human access to external dashboards/portals.**

10.1 `.env.prod` production values
- [ ] **ALLOWED_ORIGINS**: Change from `http://localhost:3000` to `https://dryft.site,https://www.dryft.site` (per TLS setup in Section 3). This controls CORS — leaving it as localhost will block real clients.
- [ ] **ENVIRONMENT**: Flip from `staging` to `production` when ready for real launch.
- [ ] **Stripe live keys**: Go to Stripe Dashboard → Developers → API Keys → copy live secret key (`sk_live_...`). Create a webhook endpoint for your production URL and get the live webhook secret (`whsec_...`). Replace test keys in `.env.prod`.
- [ ] **Managed Redis**: Provision AWS ElastiCache (or similar) Redis instance. Update `REDIS_URL` from `redis://redis:6379/0` to the managed endpoint (e.g., `redis://dryft-prod-cache.xxxxx.usw2.cache.amazonaws.com:6379/0`).
- [ ] **APNs keys**: Go to Apple Developer → Certificates, Identifiers & Profiles → Keys → create APNs key. Copy Key ID, Team ID, and `.p8` key content into `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY` in `.env.prod`.
- [ ] **Rate limiting** (new — optional): `RATE_LIMIT_REQUESTS` (default 100) and `RATE_LIMIT_WINDOW_MINUTES` (default 15) are now configurable in `.env.prod`. Adjust if you want stricter or looser limits for production traffic.

10.2 Credential rotation plan
- [ ] Regenerate `JWT_SECRET_KEY` and `ENCRYPTION_KEY` with `openssl rand -base64 32` right before go-live (current values were generated during dev and have been in local files).
- [ ] Rotate `POSTGRES_PASSWORD` to something stronger than `dryft_password` (the Docker Compose local password). The RDS `DATABASE_URL` already has its own credentials.

---

## Frontend Polish (Feb 15)

### Web Error Handler
- [x] Created `web/src/utils/errorHandler.ts` — centralized error classification, retry with exponential backoff, network state detection, error reporting
- [x] Wired `initErrorHandling()` into `Providers.tsx` for global unhandled error/rejection capture
- [x] Integrated `classifyError()`/`reportError()` into `ErrorBoundary.tsx`
- [ ] **Human TODO**: Add `@sentry/nextjs` package and wire Sentry DSN into `reportError()` (currently console-only)

### Mobile Theme Integration
- [x] Added missing color tokens to `ThemeProvider.tsx`: accent, accentSecondary, accentPink, accentYellow, textTertiary, backgroundDarkest, surfaceSecondary
- [x] Wired `ThemeProvider` into `App.tsx` (was defined but never mounted)
- [ ] **Human/Agent TODO**: Migrate hardcoded colors in screens to `useColors()` hook (850+ instances across 120+ files — large refactor, delegate to Codex agents)

### Confirmation Dialogs
- [x] Created reusable `ConfirmDialog` component (`web/src/components/ui/ConfirmDialog.tsx`)
- [x] Replaced `confirm()` in profile/edit (photo delete), messages/[matchId] (unmatch), settings/devices (device removal)
- [x] Added logout confirmation to profile and admin layout
- [x] Added confirmation to admin creator suspension and item disabling
- [ ] **Human/Agent TODO**: Add confirmation to admin verification reset (in `admin/users/page.tsx`)

---

---

## CLAUDE-Architect Update — Feb 27, 2026

### Completed by CLAUDE-Architect this session:
- [x] `/metrics` Prometheus endpoint implemented (`GET /metrics`) — Grafana wiring is now unblocked
- [x] Rate-limit values configurable via env vars (`RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_MINUTES`)
- [x] Shared types package expanded to full API coverage (13 domains, all backend models covered)
- [x] Web Zustand stores added: `matchingStore`, `chatStore`, `marketplaceStore`
- [x] npm lockfiles generated for web, mobile, desktop, shared/types (CI caching now works)
- [x] Web app `tsconfig.json` path alias fixed (`@/` now resolves correctly)
- [x] `firebase` package added to web dependencies (was imported but missing)
- [x] Web app verified: compiles clean, renders at localhost:3000

### Your remaining items (priority order for next session):
1. **APNs keys** — only blocker left for full push notification support (iOS)
2. **Stripe live keys** — needed before any real-money transactions
3. **Managed Redis** — Docker Redis is fine for staging, not production
4. **VPS deployment** (Section 3 tasks) — firewall, SSH hardening, cross-compile + deploy binary, systemd unit
5. **ALLOWED_ORIGINS** — set to `https://dryft.site` in `.env.prod` before deploying
6. **DB migrations** — back up first, then `./dryft-api -migrate` on the VPS
7. **App store setup** (Section 6) — EAS project ID, Google Maps keys, Apple/Android store config

### Branding status:
- Domain is `dryft.site` ✅
- Codebase rebrand Drift → Dryft **COMPLETE** (Feb 15 initial pass + Feb 27 mop-up of ~52 remaining refs in jwt, links, subscription, testutil, main.go)
- Directory renames `cmd/drift-api/` → `cmd/dryft-api/` and `vr-drift/` → `vr-dryft/` **DONE** (Feb 27, HUMAN-Grant + CLAUDE-Architect path updates)
- See `docs/BRANDING_DRYFT.md` for follow-up tasks requiring human action (DNS, app stores, AWS, Firebase, etc.)

---

---

## Team Task Assignments (Feb 27, 2026)

Organized by owner and priority. Work items pulled from Sections 2–10 above, `docs/BRANDING_DRYFT.md` follow-ups, and frontend polish TODOs.

---

### HUMAN-Grant — Ops, External Services, Deployment

**Priority 1 — Launch Blockers** (must complete before go-live):

| # | Task | Section | Notes |
|---|------|---------|-------|
| ~~H1~~ | ~~Rename directories~~ | Branding | **DONE** (Feb 27). Directories renamed by HUMAN-Grant, path refs updated by CLAUDE-Architect. |
| H2 | Provision APNs keys from Apple Developer portal | §2 | **DEFERRED to Mar 29** — awaiting Apple Developer approval. 7/8 secrets done. Set `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY` in `.env.prod` when approved. |
| H3 | Get Stripe live keys + create production webhook endpoint | §10.1 | Replace `sk_test_*` with `sk_live_*` and set `STRIPE_WEBHOOK_SECRET` to new `whsec_*` |
| H4 | Provision managed Redis (ElastiCache or similar) | §10.1 | Update `REDIS_URL` in `.env.prod` from Docker URL to managed endpoint |
| H5 | Set `ALLOWED_ORIGINS=https://dryft.site,https://www.dryft.site` in `.env.prod` | §10.1 | Currently `localhost:3000` — will block real clients if not changed |
| H6 | VPS deployment — firewall, SSH, binary, systemd | §3 | See §3 subtasks: `ufw`, key-only SSH, cross-compile `GOOS=linux GOARCH=amd64`, systemd unit |
| H7 | Verify DreamHost proxy headers + WebSocket upgrade | §3 | Test `X-Forwarded-For`, `X-Forwarded-Proto`, and `wss://api.dryft.site/ws` |
| H8 | Run DB migrations on production | §7 | Back up first (`pg_dump`), then `./dryft-api -migrate`. Verify 10 versions in `schema_migrations` |
| H9 | Regenerate `JWT_SECRET_KEY` + `ENCRYPTION_KEY` before go-live | §10.2 | `openssl rand -base64 32` — current values created during dev |

**Priority 2 — Required for Full Feature Set**:

| # | Task | Section | Notes |
|---|------|---------|-------|
| H10 | Set up Sentry project + copy DSN | §8 | Create project at sentry.io → React Native. Set `EXPO_PUBLIC_SENTRY_DSN` in mobile `.env` |
| H11 | App store setup — EAS project ID, Google Maps keys, Apple/Android store listings | §6 | 4 subtasks (6.1–6.4). Needed for app distribution |
| H12 | Flip `ENVIRONMENT=production` in `.env.prod` | §10.1 | Do this last, right before actual launch |

**Priority 3 — Infrastructure Hardening** (can follow shortly after launch):

| # | Task | Section | Notes |
|---|------|---------|-------|
| H13 | Create S3 bucket `dryft-terraform-state` + DynamoDB `dryft-terraform-locks`, uncomment backend in `versions.tf` | §Terraform | Enables remote state for Terraform |
| H14 | Deploy monitoring stack to VPS | §4 | `docker-compose.monitoring.yml`, set Grafana password, restrict access |
| H15 | Set up automated `pg_dump` backups to S3 | §9 | Cron job + test restore |
| H16 | Pin API Docker image tag (e.g., `dryft-backend:v1.0.0`) | §K8s | Currently `:latest` |
| H17 | Replace `api.dryft.example.com` in `ingress.yaml` with real domain + TLS | §K8s | cert-manager or manual TLS secret |

**Priority 4 — External Service Branding Updates**:

| # | Task | Source | Notes |
|---|------|--------|-------|
| H18 | DNS: verify A/CNAME for `dryft.site`, `api.dryft.site`, `cdn.dryft.site` | Branding | DreamHost DNS panel |
| H19 | Update SES verified sender to `noreply@dryft.site` | Branding | AWS SES console |
| H20 | Update Stripe webhook URLs to `api.dryft.site` | Branding | Stripe Dashboard |
| H21 | Update Jumio callback URLs to `api.dryft.site` | Branding | Jumio portal |
| H22 | Update Firebase project for new bundle ID `com.dryft.app` | Branding | Firebase console |
| H23 | Rename GitHub org/repo `drift-app` → `dryft-app` (or set up Go module proxy redirect) | Branding | Affects Go imports if renamed |
| H24 | Rename Slack channel `#drift-prod-alerts` → `#dryft-prod-alerts` | Known issue | Cosmetic but avoids confusion |
| H25 | Rename Postgres database/user from `drift` to `dryft` in production | Branding | Requires migration plan — scripts already updated |
| H26 | Rename S3 bucket/IAM user (`drift-s3-uploader` → `dryft-s3-uploader`, `drift-prod-uploads` → `dryft-prod-uploads`) | Branding | AWS console |

---

### CLAUDE-Architect — Architecture, Code Reviews, Dangerous Areas

| # | Task | Trigger | Notes |
|---|------|---------|-------|
| ~~C1~~ | ~~Update Makefile, Dockerfile, CI, CLAUDE.md after directory renames~~ | After H1 | **DONE** (Feb 27). Updated 15 files: Makefile, Dockerfile, docker-compose.yml, CLAUDE.md, READMEs (root, backend, vr-dryft), DEPLOYMENT.md, FIRST_PROD_DEPLOY.md, LAUNCH_CHECKLIST.md, setup.sh, DREAMHOST_DEPLOYMENT.md, BRANDING_DRYFT.md, _legacy_archived/README.md, CODE_REVIEW_TRACKER.md. |
| C2 | Review and approve any new migration files | On demand | Dangerous area — all schema changes need review |
| C3 | Review Codex agent PRs touching auth, realtime, safety, agegate | On demand | Per CLAUDE.md safe/dangerous area policy |
| ~~C4~~ | ~~Architecture review for production scaling~~ | Before launch | **DONE** (Feb 28). Key finding: in-memory WebSocket Hub blocks HPA — needs Redis pub/sub before horizontal scaling. DB MaxConns should be env-configurable. Redis rate limiter already safe. Single-instance DreamHost VPS is fine for now. |
| ~~C5~~ | ~~Help resolve ~421 mobile TS errors~~ | Done | **DONE** (Feb 28). Fixed ~421 errors via 10 targeted changes: generic defaults in api/client.ts, barrel export dedup, analytics event names, notification type, matchingStore/authStore interface gaps, test file module scoping, two invalid Ionicons names, services/api.ts re-export bug. |

---

### Codex Agents — Safe-Area Refactors, Tests, Polish

| # | Task | Files | Notes |
|---|------|-------|-------|
| X1 | Migrate hardcoded colors to `useColors()` hook | 120+ mobile screen/component files (~850 instances) | **IN PROGRESS** (Codex, Mar 1). CompanionScreen.tsx fully migrated. Global literals: 1933 → 1831. Affected files: 84 remaining. Next: DailyRewardsScreen, CreatorDashboardScreen, SafetyCenter. |
| ~~X2~~ | ~~Add confirmation dialog to admin verification reset~~ | `web/src/app/admin/users/page.tsx` | **DONE** (already present — Codex verified). ConfirmDialog at lines 127 and 500. |
| ~~X3~~ | ~~Wire Sentry DSN into web error handler~~ | `web/src/utils/errorHandler.ts` | **DONE** (Codex, Feb 28). Added `@sentry/nextjs`, `reportError()` now captures to Sentry when `NEXT_PUBLIC_SENTRY_DSN` is set; console-only fallback when not set. `web/package-lock.json` regenerated. 2 test suites passing. Documented in `docs/ENVIRONMENT.md`. |
| ~~X4~~ | ~~Regenerate all `package-lock.json` files~~ | `mobile/`, `desktop/`, `shared/types/` | **DONE** (Codex, Mar 1). All four lockfiles regenerated + rebrand name drift fixed. |

---

### E2E Testing Pass — All Hands (after deployment)

Section 5 in full — requires a running production-like environment. Assign to whoever is available once VPS is live:

- **Core flows** (§5.1): registration, login, profile, photos, matching, chat, video calls, push, purchases, account deletion
- **Couples features** (§5.2): linking, timeline, activities, quizzes, milestones, memories
- **Gamification** (§5.3): daily rewards, streaks, achievements, season pass, tier rewards
- **Monetization** (§5.4): premium subscription, season pass purchase, creator tips, cancellation
- **Safety** (§5.5): content reporting, AI moderation, scam detection, admin queue

---

---

## CLAUDE-Architect Update — Feb 28, 2026

### Context
- HUMAN-Grant migrated repo from failing SATA drive to new 1TB SSD. MCP filesystem restored.
- APNs (H2) deferred to Mar 29 — Apple Developer approval pending.
- H3 (Stripe live keys): likely already set in root `.env.prod` per Grant — verify before launch.
- H4 (Redis): decision pending — Docker Redis fine for current single-instance VPS.
- H5 (ALLOWED_ORIGINS): Grant plans to set tonight/tomorrow.
- H6–H12: scheduled with Perplexity over next 2 weeks.
- X1 (useColors migration), X2 (admin confirm dialog): assigned to Codex agents.

### Completed this session:
- [x] **C4** — Architecture scaling review complete. See AGENTS_COLLAB.md entry dated Feb 28.
- [x] **C5** — ~421 mobile TS errors resolved via 10 targeted fixes (see AGENTS_COLLAB.md Feb 28).

### C4 Key Findings (action items before enabling HPA):
- [ ] **WebSocket Hub** (`backend/internal/hub/hub.go`): in-memory, cannot scale horizontally. Add Redis pub/sub routing before enabling multiple HPA replicas.
- [ ] **DB connection pool** (`backend/internal/database/postgres.go`): `MaxConns: 25` hardcoded. Make configurable via `DB_MAX_CONNS` env var (suggest default 8 per replica). At HPA max 10 replicas with 25 conns each → 250 total, exceeds RDS db.t4g.micro limit (~85).
- ✅ **Redis rate limiter** — already uses shared cluster, safe for multi-replica.
- ✅ **Current DreamHost single-instance VPS** — none of these HPA issues apply. Safe as-is.

---

## Post-Launch Tasks

(To be addressed after go-live)

- [ ] Monitor Sentry for errors daily.
- [ ] Check Stripe dashboard for payment issues.
- [ ] Review app store reviews and respond.
- [ ] Set up weekly metrics review cadence.
- [ ] Plan PagerDuty integration for 24/7 on-call.

# Dryft Launch Checklist

## Quick Start

```bash
# 1. Run the setup script
./setup.sh

# 2. Configure your environment (see below)

# 3. Start development
cd backend && go run ./cmd/dryft-api
cd mobile && npm start
```

---

## Configuration Required

### Backend Environment (`backend/.env`)

| Variable | Required | How to Get |
|----------|----------|------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string (or `redis://localhost:6379`) |
| `JWT_SECRET_KEY` | Yes | Generate: `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Yes | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | [Stripe Webhooks](https://dashboard.stripe.com/webhooks) → Signing secret |
| `AWS_ACCESS_KEY_ID` | Yes | [AWS IAM](https://console.aws.amazon.com/iam/) → Create user |
| `AWS_SECRET_ACCESS_KEY` | Yes | Same as above |
| `S3_BUCKET` | Yes | [S3 Console](https://s3.console.aws.amazon.com/) → Create bucket |
| `FIREBASE_CREDENTIALS_JSON` | Yes | Firebase → Project Settings → Service Accounts → Generate new private key (JSON contents) |

### Mobile Environment (`mobile/.env`)

| Variable | Required | How to Get |
|----------|----------|------------|
| `EXPO_PUBLIC_API_URL` | Yes | Your backend URL (e.g., `https://api.dryft.site`) |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → Publishable key |
| `EXPO_PUBLIC_SENTRY_DSN` | Yes | [Sentry](https://sentry.io/) → Project Settings → DSN |
| `GOOGLE_MAPS_IOS_API_KEY` | Yes | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Yes | Same as above |

---

## Launch Readiness (Infra & Ops)

- [x] **Rebrand** complete (`Drift` -> `Dryft`, domain cutover to `dryft.site`). ✓ Feb 15
- [ ] **Secrets** provisioned in production (7/8 complete; one remaining secret pending).
- [x] **TLS/SSL** configured and active on DreamHost edge (certs installed, HSTS enabled).
- [x] **Monitoring** stack configured (Prometheus + Grafana + Alertmanager).
- [ ] **Dashboards** validated for request rate, error rate, latency, WebSocket connections.
- [ ] **Alerts** configured (high error rate, high latency, low disk space).
- [ ] **Backups** scheduled (pg_dump), and **restore tested**.
- [ ] **Rollback plan** documented with previous image tags and migration rollback steps.
- [x] **Test suites** green (Backend 29/29, Web 58/58, Mobile 121/123 with 2 known flakes). ✓ Feb 15
- [x] **Rate limiting** enabled (Redis-backed or in-memory fallback). ✓ Week 5
- [x] **Health endpoints** verified (`/health`, `/ready`, `/metrics` if available). ✓ `/ready` added Week 3
- [x] **Load test scripts** created (`infra/scripts/load-test.js`, `load-test-websocket.js`). ✓ Week 5

---

## App Store Configuration

### 1. Get EAS Project ID

```bash
cd mobile

# Login to Expo
npx eas login

# Create/link project (this generates the project ID)
npx eas init

# Copy the project ID from output or from expo.dev dashboard
```

Then update `mobile/app.json`:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "YOUR_ACTUAL_PROJECT_ID"  // ← Replace this
      }
    },
    "updates": {
      "url": "https://u.expo.dev/YOUR_ACTUAL_PROJECT_ID"  // ← And this
    }
  }
}
```

### 2. Configure Google Maps Keys

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Maps SDK for iOS" and "Maps SDK for Android"
4. Create API credentials (API Key)
5. Restrict the key to your app's bundle ID

Update `mobile/app.json`:
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "AIza..."  // ← Your iOS key
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "AIza..."  // ← Your Android key
        }
      }
    }
  }
}
```

### 3. Configure Apple App Store (`mobile/eas.json`)

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",           // ← Your Apple ID
        "ascAppId": "1234567890",              // ← App Store Connect App ID
        "appleTeamId": "ABCD1234"              // ← Apple Developer Team ID
      }
    }
  }
}
```

**Where to find these:**
- `appleId`: Your Apple Developer account email
- `appleTeamId`: [Apple Developer](https://developer.apple.com/account) → Membership → Team ID
- `ascAppId`: [App Store Connect](https://appstoreconnect.apple.com/) → Create app → App ID (numeric)

### 4. Configure Google Play Store

1. Go to [Google Play Console](https://play.google.com/console/)
2. Create your app
3. Go to Setup → API Access → Create service account
4. Download JSON key file
5. Save as `mobile/google-service-account.json`

---

## Database Setup

```bash
cd backend

# Use the built-in migration runner (tracks applied versions, runs in transactions):
make migrate

# OR via the binary directly:
./drift-api -migrate

# OR via Docker:
docker exec drift-api ./drift-api -migrate
```

**WARNING**: Do NOT run migrations manually with `psql -f` — that bypasses version tracking and would also execute `.down.sql` files.

---

## Sentry Setup

1. Go to [Sentry.io](https://sentry.io/) and create account
2. Create new project → React Native
3. Copy the DSN
4. Add to `mobile/.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
   ```

---

## Pre-Launch Verification

### Gap Analysis Additions (Completed)
- [x] Implement `/ready` endpoint for K8s readiness probes. ✓ Week 3
- [x] Confirm rate limit configuration (Redis-backed + in-memory fallback). ✓ Week 3
- [x] Error message i18n support for mobile (all 9 locales complete). ✓ Week 5
- [x] Security audit (removed X-User-ID header bypasses, verified SQL injection protection). ✓ Week 5
- [x] RTL layout support wired in mobile for future Arabic/Hebrew locales. ✓ Week 5
- [x] Load test scripts created for API and WebSocket (`infra/scripts/`). ✓ Week 5

### Remaining Pre-Launch Items
- [x] `/metrics` endpoint for Prometheus export (already implemented)
- [x] Lockfiles for `web/`, `mobile/`, `desktop/`, `shared/types/` (already exist)
- [x] Production alerts configured (service down, WebSocket drops, rate limiting, auth failures, DB connections)
- [ ] Manual testing of all core features (see checklist below)
- [x] Configure Alertmanager notification channel (Slack verified Feb 14, PagerDuty deferred)

### Run Tests
```bash
cd backend && go test ./...
cd mobile && npm run typecheck
```

### Build Test
```bash
cd mobile
npx eas build --profile preview --platform all
```

### Manual Testing Checklist

#### Core Features
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

#### Couples Features
- [ ] Couple linking/pairing
- [ ] Relationship timeline
- [ ] Activities completion
- [ ] Quizzes
- [ ] Milestones
- [ ] Memories upload

#### Gamification
- [ ] Daily rewards claiming
- [ ] Streak tracking
- [ ] Achievement unlocking
- [ ] Season pass progression
- [ ] Tier reward claiming

#### Monetization
- [ ] Couples Premium subscription
- [ ] Season pass purchase
- [ ] Creator tipping
- [ ] Subscription cancellation

#### Safety & Moderation
- [ ] Content reporting
- [ ] AI moderation triggers
- [ ] Scam detection alerts
- [ ] Admin moderation queue

---

## Launch Commands

### Deploy Backend
```bash
cd backend
docker-compose up -d
# OR deploy to Railway/Render/AWS
```

### Submit to App Stores
```bash
cd mobile

# Build for production
npx eas build --profile production --platform all

# Submit to stores
npx eas submit --platform ios
npx eas submit --platform android
```

---

## Post-Launch

- [ ] Monitor Sentry for errors
- [ ] Check Stripe dashboard for payments
- [ ] Review app store reviews
- [ ] Monitor server metrics
- [ ] Set up alerts for downtime

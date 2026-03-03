# Environment Variables

This guide consolidates environment variables across Dryft services. Defaults are shown when available.

## Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENVIRONMENT` | Yes | `development` | Runtime environment (`development`, `staging`, `production`). |
| `PORT` | Yes | `8080` | HTTP port for the API server. |
| `ALLOWED_ORIGINS` | Yes | `http://localhost:19006,http://localhost:3000` | CORS allowlist for browsers. |
| `DATABASE_URL` | Yes | `postgres://drift:drift@localhost:5432/drift?sslmode=disable` | Postgres connection string. |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string (optional). |
| `ENCRYPTION_KEY` | Yes (prod) | - | 32-byte key for AES-256 encryption. |
| `JWT_SECRET_KEY` | Yes | - | JWT signing secret (>= 32 chars in prod). |
| `STRIPE_SECRET_KEY` | Yes (payments) | - | Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | Yes (webhooks) | - | Stripe webhook signing secret. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | No | - | Stripe Connect webhook secret. |
| `STRIPE_PUBLISHABLE_KEY` | No | - | Stripe publishable key. |
| `JUMIO_API_TOKEN` | Yes (prod) | - | Jumio API token. |
| `JUMIO_API_SECRET` | Yes (prod) | - | Jumio API secret. |
| `JUMIO_WEBHOOK_SECRET` | Yes (prod) | - | Jumio webhook secret. |
| `JUMIO_BASE_URL` | No | `https://netverify.com/api/v4` | Jumio base URL. |
| `AWS_ACCESS_KEY_ID` | Yes (prod) | - | AWS access key for S3/Rekognition. |
| `AWS_SECRET_ACCESS_KEY` | Yes (prod) | - | AWS secret key for S3/Rekognition. |
| `AWS_REGION` | Yes | `us-east-1` | AWS region. |
| `S3_BUCKET` | Yes (prod) | `drift-uploads` | S3 bucket for media. |
| `S3_REGION` | Yes | `us-east-1` | S3 region (can differ from AWS_REGION). |
| `S3_ENDPOINT` | No | - | Optional S3-compatible endpoint (MinIO/Spaces). |
| `FIREBASE_CREDENTIALS_JSON` | Yes (push) | - | Firebase service account JSON. |
| `APNS_KEY_ID` | Yes (iOS) | - | APNs key ID. |
| `APNS_TEAM_ID` | Yes (iOS) | - | Apple team ID. |
| `APNS_AUTH_KEY` | Yes (iOS) | - | APNs auth key (p8). |
| `APNS_BUNDLE_ID` | Yes (iOS) | `com.dryft.app` | App bundle ID. |
| `APNS_PRODUCTION` | No | `false` | Use APNs production environment. |

## Web (`web`)

These are `NEXT_PUBLIC_*` variables consumed by Next.js at build/runtime.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8080` | Backend API base URL. |
| `NEXT_PUBLIC_WS_URL` | No | `ws://api.dryft.site:8080/v1/ws` (prod), `ws://localhost:8080/v1/ws` (dev) | WebSocket URL. Set to `wss://api.dryft.site/v1/ws` after DreamHost proxy websocket headers are fixed. |
| `NEXT_PUBLIC_SENTRY_DSN` | No | - | Sentry DSN for web client error reporting. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | - | Stripe publishable key. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | No | - | Firebase API key. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | No | - | Firebase auth domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | No | - | Firebase project ID. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | No | - | Firebase storage bucket. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No | - | Firebase sender ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | No | - | Firebase app ID. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | No | - | Web push VAPID key. |

## Mobile (`mobile/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | `https://api.dryft.site` | Backend API URL. |
| `EXPO_PUBLIC_WS_URL` | No | `ws://api.dryft.site:8080/v1/ws` (prod), `ws://localhost:8080/v1/ws` (dev) | WebSocket URL. Set to `wss://api.dryft.site/v1/ws` after DreamHost proxy websocket headers are fixed. |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID. |
| `EXPO_PUBLIC_APPLE_CLIENT_ID` | No | - | Apple OAuth client ID. |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes (payments) | - | Stripe publishable key. |
| `STRIPE_SECRET_KEY` | No | - | Stripe secret key (if used in mobile tooling). |
| `GOOGLE_MAPS_IOS_API_KEY` | Yes (maps) | - | iOS maps API key. |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Yes (maps) | - | Android maps API key. |
| `EXPO_PUBLIC_SENTRY_DSN` | Yes (prod) | - | Sentry DSN. |
| `SENTRY_ORG` | No | - | Sentry org slug. |
| `SENTRY_PROJECT` | No | - | Sentry project slug. |
| `EXPO_PUBLIC_AMPLITUDE_API_KEY` | No | - | Amplitude API key. |
| `EXPO_PUBLIC_ENABLE_VR_FEATURES` | No | `true` | Feature flag. |
| `EXPO_PUBLIC_ENABLE_VIDEO_CALLS` | No | `true` | Feature flag. |
| `EXPO_PUBLIC_ENABLE_HAPTIC_INTEGRATION` | No | `true` | Feature flag. |
| `EXPO_PUBLIC_ENVIRONMENT` | No | `development` | Mobile environment flag. |
| `EXPO_PUBLIC_DEBUG` | No | `true` | Enable debug logging. |

## Desktop (`desktop`)

No environment variables are required by default. The desktop app loads:

- Dev: `http://localhost:3000`
- Prod: `https://dryft.site`

If you introduce new desktop config, document it here.

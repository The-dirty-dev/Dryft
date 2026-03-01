# Dryft Backend API

Backend API server for the Dryft VR Dating Platform.

## Tech Stack

- **Runtime**: Go 1.24
- **Router**: chi/v5
- **Language**: Go
- **Database**: PostgreSQL (14+ recommended; 16+ supported) with pgx/pgxpool
- **Real-time**: gorilla/websocket
- **Payments**: stripe-go
- **Push Notifications**: Firebase Admin SDK (Android/Web), APNs (iOS VoIP)
- **Authentication**: JWT (golang-jwt)
- **Age Verification**: Jumio, AWS Rekognition (fallback)
- **Storage**: AWS S3
- **Caching/Rate Limits**: Redis (optional; in-memory fallback)

## Quick Start

### Prerequisites

- Go 1.24 or higher
- PostgreSQL 14 or higher
- Redis (optional, for caching/rate limiting)

### Installation

```bash
# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
make migrate
# Or via the binary directly:
# ./dryft-api -migrate

# Start development server
go run ./cmd/dryft-api

# Or build and run the binary
go build -o drift-api ./cmd/dryft-api
./dryft-api
```

### Environment Variables

Create a `.env` file with the following variables (see `.env.example` for full list):

```env
# Server
ENVIRONMENT=development
PORT=8080
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:3000

# Database
DATABASE_URL=postgres://drift:drift@localhost:5432/drift?sslmode=disable

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Encryption (required in production, must be exactly 32 bytes)
ENCRYPTION_KEY=

# JWT
JWT_SECRET_KEY=your-super-secret-key-change-in-production-32b

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Jumio (age/ID verification)
JUMIO_API_TOKEN=
JUMIO_API_SECRET=

# Firebase (push notifications - full service account JSON)
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}

# APNs (iOS VoIP push)
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_AUTH_KEY=
APNS_BUNDLE_ID=com.dryft.app

# AWS (S3 storage & Rekognition)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET=drift-uploads
S3_REGION=us-east-1
```

## API Documentation

### Base URL

```
http://localhost:8080/v1
```

### Swagger UI & Spec

- `GET /docs` – Swagger UI
- `GET /docs/openapi.yaml` – Raw OpenAPI spec

### Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

### Endpoints

#### Auth
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh access token

#### Users
- `GET /users/me` - Get current user
- `PUT /users/me` - Update current user

#### Profile (requires verification)
- `GET /profile` - Get profile
- `PATCH /profile` - Update profile
- `PUT /profile/location` - Update location
- `GET /profile/preferences` - Get preferences
- `PUT /profile/preferences` - Update preferences
- `POST /profile/photos` - Upload photo
- `DELETE /profile/photos/:index` - Delete photo by index
- `PUT /profile/photos/reorder` - Reorder photos
- `GET /profile/photos/:index/url` - Get signed photo URL
- `POST /profile/photos/upload-url` - Get signed upload URL
- `POST /profile/photos/confirm` - Confirm upload

#### Age Verification
- `POST /age-gate/card/initiate` - Start card verification
- `POST /age-gate/card/confirm` - Confirm card verification
- `POST /age-gate/id/initiate` - Start ID verification
- `GET /age-gate/status` - Check status
- `POST /age-gate/retry` - Retry verification
- `POST /age-gate/id/webhook` - Jumio webhook (public)

#### Discovery
- `GET /discover` - Get discovery feed
- `POST /discover/swipe` - Swipe on user

#### Matches
- `GET /matches` - Get matches
- `GET /matches/:matchID` - Get match
- `DELETE /matches/:matchID` - Unmatch
- `GET /matches/:matchID/conversation` - Get match conversation

#### Conversations
- `GET /conversations` - Get conversations
- `GET /conversations/:conversationID` - Get conversation
- `GET /conversations/:conversationID/messages` - Get messages
- `POST /conversations/:conversationID/messages` - Send message
- `POST /conversations/:conversationID/read` - Mark as read

#### Notifications
- `POST /notifications/devices` - Register device (FCM)
- `DELETE /notifications/devices/:deviceId` - Unregister device
- `POST /notifications/voip-devices` - Register VoIP device (iOS)
- `DELETE /notifications/voip-devices` - Unregister VoIP device
- `GET /notifications` - Get notifications
- `GET /notifications/unread-count` - Unread count
- `POST /notifications/:id/read` - Mark read
- `POST /notifications/read-all` - Mark all read

#### WebSocket
- `GET /ws` - Main realtime socket (chat, presence, calls, sessions, haptics)

#### Calls
- `GET /calls/ws` - Call signaling socket
- `POST /calls/initiate` - Initiate call
- `GET /calls/history` - Call history
- `GET /calls/active` - Active call
- `POST /calls/:id/end` - End call

#### Haptic
- `POST /haptic/devices` - Register device
- `GET /haptic/devices` - List devices
- `GET /haptic/devices/:deviceId` - Get device
- `PATCH /haptic/devices/:deviceId` - Update device
- `DELETE /haptic/devices/:deviceId` - Delete device
- `POST /haptic/permissions` - Set permission
- `GET /haptic/permissions/match/:matchId` - Get match permissions
- `DELETE /haptic/permissions` - Revoke permission
- `POST /haptic/command` - Send command
- `GET /haptic/patterns` - List patterns
- `GET /haptic/patterns/:patternId` - Get pattern
- `GET /haptic/match/:matchId/devices` - Get match devices

#### Sessions (Companion)
- `POST /sessions` - Create session
- `GET /sessions/active` - Get active session
- `POST /sessions/join` - Join by code
- `GET /sessions/:sessionId` - Get session
- `DELETE /sessions/:sessionId` - End session
- `POST /sessions/:sessionId/leave` - Leave session
- `POST /sessions/:sessionId/haptic-permission` - Set haptic permission
- `POST /sessions/:sessionId/chat` - Send chat
- `POST /sessions/:sessionId/haptic` - Send haptic

#### Store
- `GET /store/items` - Browse items
- `GET /store/items/:itemID` - Item details
- `GET /store/featured` - Featured items
- `GET /store/popular` - Popular items
- `GET /store/categories` - Categories
- `GET /store/categories/:slug/items` - Items by category
- `GET /store/search` - Search items
- `POST /store/purchase` - Initiate purchase
- `GET /store/purchases` - Purchase history

#### Inventory
- `GET /inventory` - Inventory
- `GET /inventory/equipped` - Equipped items
- `POST /inventory/equip` - Equip item
- `POST /inventory/unequip` - Unequip item
- `GET /inventory/:itemID/asset` - Asset bundle

#### Creators
- `GET /creators/featured` - Featured creators
- `GET /creators/:creatorID` - Creator profile
- `GET /creators/:creatorID/items` - Creator items
- `POST /creators` - Become creator
- `GET /creators/me` - Creator account
- `PATCH /creators/me` - Update creator profile
- `POST /creators/onboarding-link` - Stripe onboarding link
- `GET /creators/earnings` - Earnings
- `GET /creators/items` - Creator items (self)

#### Webhooks
- `POST /webhooks/stripe/marketplace` - Marketplace webhook
- `POST /webhooks/stripe/connect` - Connect webhook

#### Verification
- `GET /verification/status` - Status
- `GET /verification/score` - Trust score
- `POST /verification/photo` - Photo verification
- `POST /verification/phone/send` - Send phone code
- `POST /verification/phone/verify` - Verify phone code
- `POST /verification/email/send` - Send email code
- `POST /verification/email/verify` - Verify email code
- `POST /verification/id` - ID verification
- `POST /verification/social` - Social verification
- `GET /verification/admin/pending` - Admin: pending verifications
- `POST /verification/admin/:verificationId/review` - Admin: review verification

#### Analytics
- `POST /analytics/events` - Ingest events
- `GET /analytics/user/:userId` - User analytics
- `GET /analytics/metrics/daily` - Daily metrics
- `GET /analytics/metrics/events` - Event counts
- `GET /analytics/metrics/top-events` - Top events
- `GET /analytics/events/recent/:userId` - Recent events
- `GET /analytics/dashboard` - Dashboard summary

#### Safety
- `POST /safety/block` - Block user
- `DELETE /safety/block/:userId` - Unblock user
- `GET /safety/blocked` - Blocked users
- `GET /safety/blocked/:userId/check` - Block check
- `POST /safety/report` - Submit report
- `GET /safety/reports` - My reports
- `POST /safety/panic` - Panic event
- `GET /safety/warnings` - My warnings

#### Safety (Admin)
- `GET /admin/safety/reports` - Pending reports
- `GET /admin/safety/reports/user/:userId` - Reports against user
- `PUT /admin/safety/reports/:reportId` - Update report
- `POST /admin/safety/warnings` - Issue warning
- `GET /admin/safety/warnings/user/:userId` - User warnings
- `GET /admin/safety/panic/user/:userId` - Panic events

#### Settings
- `GET /settings` - Get settings
- `PUT /settings` - Update settings
- `POST /settings/sync` - Sync settings
- `POST /settings/reset` - Reset settings
- `PATCH /settings/notifications` - Notifications settings
- `PATCH /settings/privacy` - Privacy settings
- `PATCH /settings/appearance` - Appearance settings
- `PATCH /settings/vr` - VR settings
- `PATCH /settings/haptic` - Haptic settings
- `PATCH /settings/matching` - Matching settings
- `PATCH /settings/safety` - Safety settings

#### Avatar
- `GET /avatar` - Avatar state
- `PUT /avatar` - Update avatar
- `POST /avatar/equip` - Equip item
- `POST /avatar/unequip` - Unequip item
- `PUT /avatar/colors` - Set colors
- `PUT /avatar/name` - Set display name
- `PUT /avatar/visibility` - Set visibility
- `GET /avatar/history` - Equip history
- `GET /avatar/user/:userId` - Other user avatar
- `POST /avatar/batch` - Batch avatar fetch

#### Links
- `POST /links` - Create link
- `GET /links/:code` - Get link
- `POST /links/:code/validate` - Validate link
- `POST /links/:code/use` - Use link
- `POST /links/profile` - Create profile link
- `POST /links/vr-invite` - Create VR invite
- `GET /links/vr-invite/:code` - Get VR invite
- `GET /links/vr-invite/:code/validate` - Validate VR invite
- `POST /links/vr-invite/:code/accept` - Accept VR invite
- `POST /links/vr-invite/:code/decline` - Decline VR invite
- `POST /links/vr-invite/:code/cancel` - Cancel VR invite
- `GET /links/user/:userId/vr-invites` - User VR invites

#### Subscriptions
- `GET /subscriptions/status` - Subscription status
- `GET /subscriptions/entitlements` - Entitlements
- `POST /subscriptions/verify` - Verify purchase
- `POST /subscriptions/restore` - Restore purchases
- `POST /subscriptions/cancel` - Cancel subscription
- `POST /subscriptions/use-boost` - Use boost
- `POST /subscriptions/use-super-like` - Use super like
- `POST /subscriptions/use-like` - Use like
- `GET /subscriptions/has/:entitlement` - Check entitlement

#### Admin
- `GET /admin/dashboard` - Dashboard summary
- `GET /admin/verifications` - Verifications
- `GET /admin/verifications/pending` - Pending verifications
- `GET /admin/verifications/:id` - Verification detail
- `POST /admin/verifications/:id/approve` - Approve
- `POST /admin/verifications/:id/reject` - Reject
- `GET /admin/reports/pending` - Pending reports
- `POST /admin/reports/:id/review` - Review report
- `GET /admin/users/:id` - User detail
- `POST /admin/users/:id/ban` - Ban user
- `POST /admin/users/:id/unban` - Unban user

## WebSocket

Connect to the main WebSocket endpoint with authentication:

```
ws://localhost:8080/v1/ws?token=<access_token>
```

The backend uses gorilla/websocket with a hub-based architecture for real-time features including:

- Chat messaging and typing indicators
- Presence updates (online/offline)
- Match notifications
- Haptic device events
- Companion session sync (VR <-> Mobile)

### WebSocket Auth & Presence Notes

- WebSocket access is gated by age verification. Unverified users receive a `403`.
- The handler accepts auth via middleware context (mobile/VR clients) or a `token` query param (browser clients).
- Presence updates can be filtered to matched/allowed users when a presence filter is configured.
- Messages to slow clients may be dropped when their send buffers are full (by design to protect hub throughput).

## Database

### Running Migrations

SQL migration files are located in `internal/database/migrations/`. Apply them in order:

```bash
# Apply all migrations
for f in internal/database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done

# Or use a migration tool like golang-migrate:
# go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
# migrate -path internal/database/migrations -database "$DATABASE_URL" up
```

### Viewing Data

Use `psql` or any PostgreSQL client (pgAdmin, DBeaver, etc.) to connect directly:

```bash
psql "$DATABASE_URL"
```

## Testing

```bash
go test ./...

# With verbose output
go test -v ./...

# Specific package
go test -v ./internal/auth/...
```

## Deployment

### Build

```bash
go build -o drift-api ./cmd/dryft-api
```

### Production

```bash
ENVIRONMENT=production ./dryft-api
```

### Docker

The project includes a multi-stage `Dockerfile` that builds a minimal Alpine-based image:

```bash
# Build the image
docker build -t drift-backend .

# Run with docker-compose (includes Postgres + Redis)
docker-compose up -d
```

The `docker-compose.yml` automatically applies SQL migrations via the Postgres `initdb.d` directory on first start.

## Stripe Webhooks

Set up webhook endpoints in Stripe Dashboard pointing to:

```
https://your-domain.com/v1/webhooks/stripe/marketplace
https://your-domain.com/v1/webhooks/stripe/connect
```

Listen for these events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Project Structure

```
backend/
├── cmd/
│   └── drift-api/
│       └── main.go           # Entry point
├── internal/
│   ├── admin/                # Admin handlers & service
│   ├── agegate/              # Age verification (Jumio, Rekognition, FaceMatch)
│   ├── analytics/            # Analytics service
│   ├── auth/                 # JWT authentication
│   ├── avatar/               # Avatar service
│   ├── calls/                # VoIP/video call signaling
│   ├── chat/                 # Chat service & handler
│   ├── config/               # Configuration loader
│   ├── database/             # PostgreSQL connection
│   │   └── migrations/       # SQL migration files
│   ├── haptic/               # Haptic device management
│   ├── links/                # Link sharing service
│   ├── marketplace/          # Store, inventory, purchases
│   ├── matching/             # Discovery & swiping logic
│   ├── middleware/           # Auth middleware
│   ├── models/               # Data models
│   ├── notifications/        # Push notifications (FCM, APNs)
│   ├── profile/              # User profile service
│   ├── realtime/             # WebSocket hub & signaling
│   ├── safety/               # Content moderation & safety
│   ├── session/              # Companion sessions (VR ↔ Mobile)
│   ├── settings/             # User settings
│   ├── storage/              # S3 storage service
│   ├── subscription/         # Subscription management
│   ├── verification/         # Age/ID verification
│   └── voice/                # Voice processing service
├── .env.example              # Environment template
├── Dockerfile                # Multi-stage Go build
├── docker-compose.yml        # Local dev stack (Postgres + Redis + API)
├── go.mod
└── go.sum
```

## License

Proprietary - Dryft Inc.

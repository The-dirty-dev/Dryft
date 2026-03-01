# Dryft Backend API Reference

This document provides a route-group overview with sample requests and responses. For canonical schemas, also consult `backend/openapi.yaml`.

## Base URL

```
http://localhost:8080/v1
```

## Authentication

Most endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

Age-restricted endpoints also require the user to be verified.

## Common Patterns

- **Pagination**: `limit` and `offset` query params where applicable.
- **IDs**: UUID strings in path params.
- **Errors**: Handlers return JSON error payloads with HTTP status codes (exact shape varies by handler).

---

## Auth

### `POST /auth/register`
Request:
```json
{ "email": "user@example.com", "password": "secret", "display_name": "Alex" }
```
Response:
```json
{ "user": { "id": "...", "email": "user@example.com" }, "tokens": { "access_token": "..." } }
```

### `POST /auth/login`
Request:
```json
{ "email": "user@example.com", "password": "secret" }
```
Response:
```json
{ "user": { "id": "..." }, "tokens": { "access_token": "..." } }
```

### `POST /auth/refresh`
Request:
```json
{ "refresh_token": "..." }
```
Response:
```json
{ "access_token": "...", "refresh_token": "...", "expires_in": 3600 }
```

---

## Users

### `GET /users/me`
Response:
```json
{ "id": "...", "email": "user@example.com", "verified": true }
```

### `PUT /users/me`
Request:
```json
{ "display_name": "Alex", "bio": "Hello" }
```
Response:
```json
{ "id": "...", "display_name": "Alex", "bio": "Hello" }
```

---

## Profile (verified)

### `GET /profile`
Response:
```json
{ "user_id": "...", "display_name": "Alex", "photos": [] }
```

### `PATCH /profile`
Request:
```json
{ "bio": "Updated bio" }
```
Response:
```json
{ "user_id": "...", "bio": "Updated bio" }
```

### `POST /profile/photos`
Multipart form field `photo`.
Response:
```json
{ "status": "uploaded" }
```

---

## Age Verification

### `POST /age-gate/card/initiate`
Response:
```json
{ "client_secret": "seti_..." }
```

### `GET /age-gate/status`
Response:
```json
{ "verified": true, "status": "approved" }
```

---

## Discovery

### `GET /discover`
Response:
```json
{ "profiles": [ { "id": "...", "display_name": "Riley" } ] }
```

### `POST /discover/swipe`
Request:
```json
{ "target_user_id": "...", "direction": "like" }
```
Response:
```json
{ "matched": false }
```

---

## Matches

### `GET /matches`
Response:
```json
{ "matches": [ { "id": "...", "conversation_id": "..." } ] }
```

### `DELETE /matches/:matchID`
Response:
```json
{ "status": "unmatched" }
```

---

## Conversations

### `GET /conversations/:conversationID/messages`
Response:
```json
{ "messages": [ { "id": "...", "content": "Hello" } ] }
```

### `POST /conversations/:conversationID/messages`
Request:
```json
{ "type": "text", "content": "Hey" }
```
Response:
```json
{ "id": "...", "content": "Hey" }
```

---

## Notifications

### `POST /notifications/devices`
Request:
```json
{ "token": "fcm-token", "platform": "android" }
```
Response:
```json
{ "device_id": "..." }
```

### `GET /notifications`
Response:
```json
{ "notifications": [], "unread_count": 0 }
```

---

## WebSocket

### `GET /ws`
Connect via:
```
ws://localhost:8080/v1/ws?token=<access_token>
```
See `backend/WEBSOCKET_EVENTS.md` for event details.

---

## Calls

### `POST /calls/initiate`
Request:
```json
{ "match_id": "...", "video_enabled": true }
```
Response:
```json
{ "call_id": "...", "callee_id": "..." }
```

---

## Haptic

### `POST /haptic/devices`
Request:
```json
{ "device_name": "Lush 3", "can_vibrate": true }
```
Response:
```json
{ "id": "...", "device_name": "Lush 3" }
```

### `POST /haptic/command`
Request:
```json
{ "target_user_id": "...", "command_type": "vibrate", "intensity": 0.6 }
```
Response:
```json
{ "status": "sent" }
```

---

## Sessions (Companion)

### `POST /sessions/join`
Request:
```json
{ "session_code": "123456", "device_type": "mobile" }
```
Response:
```json
{ "session": { "id": "..." }, "participants": [] }
```

---

## Store

### `GET /store/items`
Response:
```json
{ "items": [ { "id": "...", "name": "Neon Outfit" } ] }
```

### `POST /store/purchase`
Request:
```json
{ "item_id": "..." }
```
Response:
```json
{ "purchase_id": "...", "client_secret": "pi_..." }
```

---

## Inventory

### `GET /inventory`
Response:
```json
{ "items": [ { "item_id": "..." } ] }
```

---

## Creators

### `POST /creators`
Request:
```json
{ "display_name": "Creator" }
```
Response:
```json
{ "id": "...", "status": "active" }
```

---

## Verification

### `GET /verification/status`
Response:
```json
{ "verifications": [], "trust_score": 0, "is_verified": false }
```

### `POST /verification/phone/send`
Request:
```json
{ "phone_number": "+15555550123" }
```
Response:
```json
{ "verification_id": "...", "expires_at": 1700000000 }
```

---

## Analytics

### `POST /analytics/events`
Request:
```json
{ "events": [ { "name": "app_open", "timestamp": 1700000000 } ] }
```
Response:
```json
{ "status": "accepted", "count": 1 }
```

---

## Safety

### `POST /safety/report`
Request:
```json
{ "reported_user_id": "...", "category": "harassment", "reason": "spam" }
```
Response:
```json
{ "success": true, "report_id": "..." }
```

---

## Settings

### `GET /settings`
Response:
```json
{ "settings": { "notifications": {}, "privacy": {} } }
```

---

## Avatar

### `PUT /avatar/colors`
Request:
```json
{ "skin_tone": "#D2A67A", "hair_color": "#3B2219" }
```
Response:
```json
{ "status": "updated" }
```

---

## Links

### `POST /links/vr-invite`
Request:
```json
{ "room_type": "booth" }
```
Response:
```json
{ "invite_code": "ABC123", "url": "https://dryft.site/vr/invite/ABC123" }
```

---

## Subscriptions

### `GET /subscriptions/status`
Response:
```json
{ "tier": "premium", "entitlements": {} }
```

---

## Admin

### `GET /admin/dashboard`
Response:
```json
{ "users": 100, "reports_pending": 2 }
```

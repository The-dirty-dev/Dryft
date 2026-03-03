# Dryft WebSocket Events Contract

> **Version:** 1.0
> **Last updated:** 2026-01-31
> **Source of truth:** `backend/internal/realtime/messages.go`
> **Clients:** React Native (mobile), Unity (VR)

This document defines every WebSocket event exchanged between clients and the
Dryft backend. Both the mobile (React Native) and VR (Unity) clients MUST use
the exact event names and payload shapes described here.

---

## Transport

| Property | Value |
|---|---|
| Endpoint (production) | `ws://api.dryft.site:8080/v1/ws` (direct — see note) |
| Endpoint (after Nginx fix) | `wss://api.dryft.site/v1/ws` |
| Endpoint (local dev) | `ws://localhost:8080/v1/ws` |
| Auth | `Authorization: Bearer <JWT>` header (mobile/VR) or `?token=<JWT>` query param (browser) |
| Prerequisite | User must be age-verified (`verified = true`) |
| Max message size | 4096 bytes |
| Ping/Pong | Client sends `ping` every 30 s; server replies `pong`. Server-level WebSocket pings are sent every 54 s; clients must respond within 60 s or the connection is closed. |

### Envelope

Every message is a JSON object with this shape:

```json
{
  "type": "<event_name>",
  "payload": { },
  "ts": 1706745600000
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `string` | One of the event names listed below. |
| `payload` | `object \| null` | Event-specific data. Omitted or `null` when not applicable. |
| `ts` | `int64` | Unix epoch milliseconds. Set by the sender (client or server). |

---

## Legend

| Symbol | Meaning |
|---|---|
| C -> S | Client sends to server |
| S -> C | Server sends to client |
| Bi | Bidirectional -- either side may send |

All UUID fields are serialised as lowercase hyphenated strings
(`"550e8400-e29b-41d4-a716-446655440000"`).

All timestamp fields (`created_at`, `matched_at`, `read_at`, `timestamp`,
`joined_at`, etc.) are **Unix epoch milliseconds** (`int64`).

---

## 1. Session / Connectivity

These events manage the low-level WebSocket lifecycle.

### `ping`

| | |
|---|---|
| Direction | C -> S |
| Description | Client heartbeat. Server replies with `pong`. |

**Payload:** _none_

```json
{ "type": "ping", "ts": 1706745600000 }
```

### `pong`

| | |
|---|---|
| Direction | S -> C |
| Description | Server heartbeat response. |

**Payload:** _none_

```json
{ "type": "pong", "ts": 1706745600001 }
```

### `error`

| | |
|---|---|
| Direction | S -> C |
| Description | Generic error sent in response to a malformed or unauthorised client request. |

**Payload:**

```json
{
  "code": "invalid_payload",
  "message": "Invalid subscribe payload"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | `string` | yes | Machine-readable error code. Known values: `invalid_message`, `invalid_payload`, `access_denied`, `invalid_type`, `send_failed`, `mark_read_failed`, `unknown_event`. |
| `message` | `string` | yes | Human-readable description. |

---

## 2. Chat

### `subscribe`

| | |
|---|---|
| Direction | C -> S |
| Description | Subscribe to real-time updates for a conversation. Server verifies the user has access. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required |
|---|---|---|
| `conversation_id` | `UUID` | yes |

### `unsubscribe`

| | |
|---|---|
| Direction | C -> S |
| Description | Unsubscribe from a conversation's real-time updates. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required |
|---|---|---|
| `conversation_id` | `UUID` | yes |

### `send_message`

| | |
|---|---|
| Direction | C -> S |
| Description | Send a chat message in a conversation. On success the server responds with `message_sent` to the sender and broadcasts `new_message` to other subscribers. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "content": "Hey, how are you?",
  "client_id": "1706745600000-a1b2c3d4e"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `conversation_id` | `UUID` | yes | |
| `type` | `string` | yes | One of `"text"`, `"image"`, `"gif"`. Defaults to `"text"` if empty. |
| `content` | `string` | yes | Message body or media URL. |
| `client_id` | `string` | no | Client-generated ID for deduplication. Echoed back in `message_sent`. |

### `message_sent`

| | |
|---|---|
| Direction | S -> C |
| Description | Confirmation that the server persisted the message. Sent only to the sender. |

**Payload:**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_id": "1706745600000-a1b2c3d4e",
  "created_at": 1706745600123
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `UUID` | yes | Server-assigned message ID. |
| `conversation_id` | `UUID` | yes | |
| `client_id` | `string` | no | Echoed from `send_message` if provided. |
| `created_at` | `int64` | yes | Unix ms. |

### `new_message`

| | |
|---|---|
| Direction | S -> C |
| Description | A new message from another user in a subscribed conversation. |

**Payload:**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_id": "770e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "content": "Hey, how are you?",
  "created_at": 1706745600123
}
```

| Field | Type | Required |
|---|---|---|
| `id` | `UUID` | yes |
| `conversation_id` | `UUID` | yes |
| `sender_id` | `UUID` | yes |
| `type` | `string` | yes |
| `content` | `string` | yes |
| `created_at` | `int64` | yes |

### `typing_start`

| | |
|---|---|
| Direction | C -> S |
| Description | The user started typing. Server auto-clears after 5 seconds. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `typing_stop`

| | |
|---|---|
| Direction | C -> S |
| Description | The user stopped typing. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `typing`

| | |
|---|---|
| Direction | S -> C |
| Description | Typing indicator broadcast to other conversation subscribers. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "770e8400-e29b-41d4-a716-446655440000",
  "is_typing": true
}
```

| Field | Type | Required |
|---|---|---|
| `conversation_id` | `UUID` | yes |
| `user_id` | `UUID` | yes |
| `is_typing` | `bool` | yes |

### `mark_read`

| | |
|---|---|
| Direction | C -> S |
| Description | Mark all messages in a conversation as read. Server broadcasts `messages_read` to other subscribers. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `messages_read`

| | |
|---|---|
| Direction | S -> C |
| Description | Read receipt broadcast to other conversation subscribers. |

**Payload:**

```json
{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "reader_id": "770e8400-e29b-41d4-a716-446655440000",
  "read_at": 1706745600500
}
```

| Field | Type | Required |
|---|---|---|
| `conversation_id` | `UUID` | yes |
| `reader_id` | `UUID` | yes |
| `read_at` | `int64` | yes |

---

## 3. Presence

### `presence`

| | |
|---|---|
| Direction | S -> C |
| Description | Online/offline status change for a matched user. Broadcast automatically when connections are registered or unregistered. |

**Payload:**

```json
{
  "user_id": "770e8400-e29b-41d4-a716-446655440000",
  "is_online": false,
  "last_seen": 1706745500000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `user_id` | `UUID` | yes | |
| `is_online` | `bool` | yes | |
| `last_seen` | `int64` | no | Unix ms. Present only when `is_online` is `false`. |

---

## 4. Matching

### `new_match`

| | |
|---|---|
| Direction | S -> C |
| Description | Two users matched. Sent to both users simultaneously by the server. |

**Payload:**

```json
{
  "match_id": "880e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "user": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "display_name": "Alex",
    "photo_url": "https://cdn.dryft.site/photos/abc.jpg"
  },
  "matched_at": 1706745600000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `match_id` | `UUID` | yes | |
| `conversation_id` | `UUID` | yes | Auto-created conversation for the match. |
| `user` | `object` | yes | The _other_ user's info. |
| `user.id` | `UUID` | yes | |
| `user.display_name` | `string` | yes | |
| `user.photo_url` | `string` | no | |
| `matched_at` | `int64` | yes | |

### `unmatched`

| | |
|---|---|
| Direction | S -> C |
| Description | A match was dissolved. Sent to the other user. |

**Payload:**

```json
{
  "match_id": "880e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required |
|---|---|---|
| `match_id` | `UUID` | yes |
| `conversation_id` | `UUID` | yes |

---

## 5. Calls (WebRTC Signaling)

All call events are **bidirectional**: the client sends them with a
`target_user_id` and the server relays the event to that user. The server
enriches `call_request` with caller profile info before delivery.

### `call_request`

| | |
|---|---|
| Direction | Bi |
| Description | Initiate a call. The server transforms the payload before delivering it to the callee. |

**Sent by caller (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "770e8400-e29b-41d4-a716-446655440000",
  "match_id": "880e8400-e29b-41d4-a716-446655440000",
  "video_enabled": true
}
```

**Received by callee (S -> C):**

```json
{
  "call_id": "call_abc123",
  "caller_id": "990e8400-e29b-41d4-a716-446655440000",
  "caller_name": "Alex",
  "caller_photo": "https://cdn.dryft.site/photos/abc.jpg",
  "video_enabled": true,
  "match_id": "880e8400-e29b-41d4-a716-446655440000"
}
```

| Field (caller sends) | Type | Required |
|---|---|---|
| `call_id` | `string` | yes |
| `target_user_id` | `UUID` | yes |
| `match_id` | `UUID` | no |
| `video_enabled` | `bool` | no |

| Field (callee receives) | Type | Required | Notes |
|---|---|---|---|
| `call_id` | `string` | yes | |
| `caller_id` | `UUID` | yes | Set by server. |
| `caller_name` | `string` | yes | Set by server. |
| `caller_photo` | `string` | no | Set by server. |
| `video_enabled` | `bool` | yes | |
| `match_id` | `UUID` | yes | |

### `call_accept`

| | |
|---|---|
| Direction | Bi |
| Description | Accept an incoming call. |

**Payload:**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000"
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123"
}
```

### `call_reject`

| | |
|---|---|
| Direction | Bi |
| Description | Reject an incoming call. |

**Payload (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000",
  "reason": "busy"
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123",
  "reason": "busy"
}
```

### `call_end`

| | |
|---|---|
| Direction | Bi |
| Description | End an active call. |

**Payload (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000",
  "reason": "user_hangup"
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123",
  "reason": "user_hangup"
}
```

### `call_busy`

| | |
|---|---|
| Direction | Bi |
| Description | Callee is already in another call. |

**Payload (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000"
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123"
}
```

### `call_offer`

| | |
|---|---|
| Direction | Bi |
| Description | Send WebRTC SDP offer. |

**Payload (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000",
  "sdp": { "type": "offer", "sdp": "v=0\r\n..." }
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123",
  "sdp": { "type": "offer", "sdp": "v=0\r\n..." }
}
```

### `call_answer`

| | |
|---|---|
| Direction | Bi |
| Description | Send WebRTC SDP answer. |

**Payload (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000",
  "sdp": { "type": "answer", "sdp": "v=0\r\n..." }
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123",
  "sdp": { "type": "answer", "sdp": "v=0\r\n..." }
}
```

### `call_candidate`

| | |
|---|---|
| Direction | Bi |
| Description | Send WebRTC ICE candidate. |

**Payload (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000",
  "candidate": {
    "candidate": "candidate:842163049 1 udp ...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123",
  "candidate": {
    "candidate": "candidate:842163049 1 udp ...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### `call_mute`

| | |
|---|---|
| Direction | Bi |
| Description | Notify remote peer that local audio is muted. |

**Payload (C -> S):**

```json
{
  "call_id": "call_abc123",
  "target_user_id": "990e8400-e29b-41d4-a716-446655440000"
}
```

**Relayed to target as:**

```json
{
  "call_id": "call_abc123"
}
```

### `call_unmute`

| | |
|---|---|
| Direction | Bi |
| Description | Notify remote peer that local audio is unmuted. |

**Payload:** Same shape as `call_mute`.

### `call_video_off`

| | |
|---|---|
| Direction | Bi |
| Description | Notify remote peer that local video is turned off. |

**Payload:** Same shape as `call_mute`.

### `call_video_on`

| | |
|---|---|
| Direction | Bi |
| Description | Notify remote peer that local video is turned on. |

**Payload:** Same shape as `call_mute`.

---

## 6. Haptic Device Control

These events handle real-time haptic device interaction between users.

### `haptic_command`

| | |
|---|---|
| Direction | Bi |
| Description | Send a haptic command to a user's connected device. |

**Payload:**

```json
{
  "target_user_id": "770e8400-e29b-41d4-a716-446655440000",
  "command_type": "vibrate",
  "intensity": 0.7,
  "duration_ms": 2000,
  "pattern_name": ""
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `target_user_id` | `UUID` | yes | Recipient of the command. |
| `command_type` | `string` | yes | `"vibrate"`, `"pattern"`, `"stop"`. |
| `intensity` | `float64` | no | 0.0 -- 1.0. |
| `duration_ms` | `int` | no | Milliseconds. |
| `pattern_name` | `string` | no | Named pattern to execute. |

### `haptic_device_status`

| | |
|---|---|
| Direction | Bi |
| Description | Notify peers about haptic device connection state. |

**Payload:**

```json
{
  "user_id": "770e8400-e29b-41d4-a716-446655440000",
  "device_connected": true,
  "device_name": "Lovense Lush 3"
}
```

| Field | Type | Required |
|---|---|---|
| `user_id` | `UUID` | yes |
| `device_connected` | `bool` | yes |
| `device_name` | `string` | no |

### `haptic_permission_request`

| | |
|---|---|
| Direction | C -> S |
| Description | Request permission to control another user's haptic device. |

**Payload:**

```json
{
  "target_user_id": "770e8400-e29b-41d4-a716-446655440000",
  "match_id": "880e8400-e29b-41d4-a716-446655440000"
}
```

### `haptic_permission_response`

| | |
|---|---|
| Direction | Bi |
| Description | Grant or deny a haptic control permission request. |

**Payload:**

```json
{
  "requester_id": "990e8400-e29b-41d4-a716-446655440000",
  "permission_type": "always",
  "max_intensity": 0.8,
  "granted": true
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `requester_id` | `UUID` | yes | The user who requested control. |
| `permission_type` | `string` | yes | `"always"`, `"request"`, `"never"`. |
| `max_intensity` | `float64` | no | 0.0 -- 1.0. Caps the allowed intensity. |
| `granted` | `bool` | yes | |

### `haptic_stop`

| | |
|---|---|
| Direction | Bi |
| Description | Immediately stop all haptic activity on a user's device. |

**Payload:**

```json
{
  "target_user_id": "770e8400-e29b-41d4-a716-446655440000"
}
```

---

## 7. Companion Sessions (VR <-> Mobile/Web)

These events manage multi-user companion sessions where a VR user streams
their state to mobile/web viewers.

### `session_join`

| | |
|---|---|
| Direction | C -> S |
| Description | Join a companion session using a 6-digit code. |

**Payload:**

```json
{
  "session_code": "482910",
  "display_name": "Alex's Phone"
}
```

| Field | Type | Required |
|---|---|---|
| `session_code` | `string` | yes |
| `display_name` | `string` | no |

### `session_joined`

| | |
|---|---|
| Direction | S -> C |
| Description | Confirmation that the client successfully joined a session. Includes full session state. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "session_code": "482910",
  "host": {
    "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
    "display_name": "VR User",
    "photo_url": "https://cdn.dryft.site/photos/vr.jpg",
    "is_host": true,
    "is_vr": true,
    "device_type": "vr",
    "joined_at": 1706745500000
  },
  "participants": [],
  "vr_state": null
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `session_id` | `UUID` | yes | |
| `session_code` | `string` | yes | |
| `host` | `SessionUser` | yes | See SessionUser schema below. |
| `participants` | `SessionUser[]` | yes | Excludes the host. |
| `vr_state` | `VRState \| null` | no | Current VR state snapshot if available. |

**SessionUser schema:**

| Field | Type | Required |
|---|---|---|
| `user_id` | `UUID` | yes |
| `display_name` | `string` | yes |
| `photo_url` | `string` | no |
| `is_host` | `bool` | yes |
| `is_vr` | `bool` | yes |
| `device_type` | `string` | yes |
| `joined_at` | `int64` | yes |

`device_type` is one of: `"vr"`, `"mobile"`, `"web"`.

### `session_leave`

| | |
|---|---|
| Direction | C -> S |
| Description | Leave the current companion session. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000"
}
```

### `session_user_joined`

| | |
|---|---|
| Direction | S -> C |
| Description | Broadcast to all session members when a new user joins. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user": {
    "user_id": "cc0e8400-e29b-41d4-a716-446655440000",
    "display_name": "Viewer",
    "photo_url": null,
    "is_host": false,
    "is_vr": false,
    "device_type": "mobile",
    "joined_at": 1706745600000
  }
}
```

### `session_user_left`

| | |
|---|---|
| Direction | S -> C |
| Description | Broadcast to all session members when a user leaves. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "cc0e8400-e29b-41d4-a716-446655440000",
  "reason": "left"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `session_id` | `UUID` | yes | |
| `user_id` | `UUID` | yes | |
| `reason` | `string` | no | `"left"`, `"disconnected"`, `"kicked"`. |

### `session_state`

| | |
|---|---|
| Direction | S -> C (originated by VR client, relayed by server) |
| Description | VR user broadcasts their real-time state (position, activity, device status). |

**Payload (VRState):**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "avatar_position": { "x": 1.0, "y": 0.0, "z": -3.5 },
  "avatar_rotation": { "x": 0.0, "y": 180.0, "z": 0.0 },
  "head_position": { "x": 1.0, "y": 1.7, "z": -3.5 },
  "left_hand_pos": { "x": 0.7, "y": 1.2, "z": -3.3 },
  "right_hand_pos": { "x": 1.3, "y": 1.2, "z": -3.3 },
  "current_activity": "dancing",
  "current_room": "lounge",
  "haptic_device_connected": true,
  "haptic_device_name": "Lovense Lush 3",
  "haptic_intensity": 0.5
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `session_id` | `UUID` | yes | |
| `user_id` | `UUID` | yes | |
| `avatar_position` | `Vector3` | no | `{ x, y, z }` floats. |
| `avatar_rotation` | `Vector3` | no | Euler angles. |
| `head_position` | `Vector3` | no | |
| `left_hand_pos` | `Vector3` | no | |
| `right_hand_pos` | `Vector3` | no | |
| `current_activity` | `string` | no | `"idle"`, `"dancing"`, `"interacting"`. |
| `current_room` | `string` | no | `"lounge"`, `"booth"`. |
| `haptic_device_connected` | `bool` | yes | |
| `haptic_device_name` | `string` | no | |
| `haptic_intensity` | `float64` | no | 0.0 -- 1.0 current intensity. |

### `session_chat`

| | |
|---|---|
| Direction | Bi |
| Description | Chat message within a companion session. Client sends `content`; server enriches with `user_id`, `display_name`, and `timestamp` before broadcast. |

**Payload (C -> S):**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "content": "This looks amazing!"
}
```

**Payload (S -> C, broadcast):**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "cc0e8400-e29b-41d4-a716-446655440000",
  "display_name": "Viewer",
  "content": "This looks amazing!",
  "timestamp": 1706745600500
}
```

| Field | Type | Set by | Notes |
|---|---|---|---|
| `session_id` | `UUID` | client | |
| `user_id` | `UUID` | server | |
| `display_name` | `string` | server | |
| `content` | `string` | client | |
| `timestamp` | `int64` | server | Unix ms. |

### `session_haptic`

| | |
|---|---|
| Direction | Bi |
| Description | Send a haptic command to another user within a companion session. Server enriches `from_user_id`. |

**Payload (C -> S):**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "to_user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "command_type": "vibrate",
  "intensity": 0.6,
  "duration_ms": 3000,
  "pattern_name": ""
}
```

**Payload (S -> C):**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "from_user_id": "cc0e8400-e29b-41d4-a716-446655440000",
  "to_user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "command_type": "vibrate",
  "intensity": 0.6,
  "duration_ms": 3000,
  "pattern_name": ""
}
```

| Field | Type | Set by | Notes |
|---|---|---|---|
| `session_id` | `UUID` | client | |
| `from_user_id` | `UUID` | server | |
| `to_user_id` | `UUID` | client | Target user. |
| `command_type` | `string` | client | `"vibrate"`, `"pattern"`, `"stop"`. |
| `intensity` | `float64` | client | 0.0 -- 1.0. |
| `duration_ms` | `int` | client | |
| `pattern_name` | `string` | client | |

### `session_reaction`

| | |
|---|---|
| Direction | Bi |
| Description | Send a reaction emoji within a companion session. Server enriches `user_id`. |

**Payload (C -> S):**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "reaction_type": "heart"
}
```

**Payload (S -> C, broadcast):**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "cc0e8400-e29b-41d4-a716-446655440000",
  "reaction_type": "heart"
}
```

| Field | Type | Set by | Notes |
|---|---|---|---|
| `session_id` | `UUID` | client | |
| `user_id` | `UUID` | server | |
| `reaction_type` | `string` | client | `"heart"`, `"fire"`, `"wink"`, etc. |

### `session_ended`

| | |
|---|---|
| Direction | S -> C |
| Description | The companion session has ended. All participants are disconnected. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "reason": "host_ended"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `session_id` | `UUID` | yes | |
| `reason` | `string` | yes | `"host_ended"`, `"expired"`, `"all_left"`. |

---

## 8. Voice Chat

Voice chat events operate within a companion session scope.

### `voice_join`

| | |
|---|---|
| Direction | C -> S |
| Description | Join the voice channel for a session. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000"
}
```

### `voice_joined`

| | |
|---|---|
| Direction | S -> C |
| Description | Confirmation of joining voice, including current participant list. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "participants": [
    {
      "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
      "display_name": "VR User",
      "is_speaking": false,
      "is_muted": false,
      "joined_at": 1706745500000
    }
  ]
}
```

| Field | Type | Required |
|---|---|---|
| `session_id` | `UUID` | yes |
| `participants` | `VoiceParticipant[]` | yes |

**VoiceParticipant schema:**

| Field | Type |
|---|---|
| `user_id` | `UUID` |
| `display_name` | `string` |
| `is_speaking` | `bool` |
| `is_muted` | `bool` |
| `joined_at` | `int64` |

### `voice_leave`

| | |
|---|---|
| Direction | C -> S |
| Description | Leave the voice channel. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000"
}
```

### `voice_speaking`

| | |
|---|---|
| Direction | Bi |
| Description | Speaking state changed. Client sends own state; server broadcasts to others. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "speaking": true
}
```

| Field | Type | Set by |
|---|---|---|
| `session_id` | `UUID` | client |
| `user_id` | `UUID` | server (set on broadcast) |
| `speaking` | `bool` | client |

### `voice_participant_joined`

| | |
|---|---|
| Direction | S -> C |
| Description | A new participant joined the voice channel. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "cc0e8400-e29b-41d4-a716-446655440000",
  "display_name": "Viewer"
}
```

### `voice_participant_left`

| | |
|---|---|
| Direction | S -> C |
| Description | A participant left the voice channel. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "cc0e8400-e29b-41d4-a716-446655440000"
}
```

### `voice_mute`

| | |
|---|---|
| Direction | Bi |
| Description | Mute state changed. Client sends own state; server broadcasts. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "muted": true
}
```

| Field | Type | Set by |
|---|---|---|
| `session_id` | `UUID` | client |
| `user_id` | `UUID` | server |
| `muted` | `bool` | client |

### `voice_error`

| | |
|---|---|
| Direction | S -> C |
| Description | Voice-specific error. |

**Payload:**

```json
{
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "error": "Session not found",
  "code": "session_not_found"
}
```

| Field | Type | Required |
|---|---|---|
| `session_id` | `UUID` | no |
| `error` | `string` | yes |
| `code` | `string` | no |

---

## 9. Avatar Sync

Avatar events let clients synchronise cosmetic state in real time.

### `avatar_update`

| | |
|---|---|
| Direction | Bi |
| Description | Full avatar state snapshot. Client sends own state; server broadcasts with `user_id` to others. |

**Payload:**

```json
{
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "equipped_avatar_id": "avatar_001",
  "equipped_outfit_id": "outfit_042",
  "equipped_effect_id": "effect_sparkle",
  "skin_tone": "#D2A67A",
  "hair_color": "#3B2219",
  "eye_color": "#4A90D9",
  "display_name": "Alex",
  "is_visible": true
}
```

| Field | Type | Set by | Notes |
|---|---|---|---|
| `user_id` | `UUID` | server | Set on broadcast. |
| `equipped_avatar_id` | `string` | client | |
| `equipped_outfit_id` | `string` | client | |
| `equipped_effect_id` | `string` | client | |
| `skin_tone` | `string` | client | Hex colour. |
| `hair_color` | `string` | client | Hex colour. |
| `eye_color` | `string` | client | Hex colour. |
| `display_name` | `string` | client | |
| `is_visible` | `bool` | client | |

### `avatar_equip`

| | |
|---|---|
| Direction | Bi |
| Description | A single item was equipped. |

**Payload:**

```json
{
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "item_id": "outfit_042",
  "item_type": "outfit"
}
```

| Field | Type | Set by | Notes |
|---|---|---|---|
| `user_id` | `UUID` | server | |
| `item_id` | `string` | client | |
| `item_type` | `string` | client | `"avatar"`, `"outfit"`, `"effect"`. |

### `avatar_unequip`

| | |
|---|---|
| Direction | Bi |
| Description | An item was unequipped. |

**Payload:**

```json
{
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "item_type": "effect"
}
```

| Field | Type | Set by |
|---|---|---|
| `user_id` | `UUID` | server |
| `item_type` | `string` | client |

### `avatar_emote`

| | |
|---|---|
| Direction | Bi |
| Description | Trigger an emote animation. |

**Payload:**

```json
{
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "emote_id": 5
}
```

| Field | Type | Set by |
|---|---|---|
| `user_id` | `UUID` | server |
| `emote_id` | `int` | client |

### `avatar_colors`

| | |
|---|---|
| Direction | Bi |
| Description | Colour customisation changed (partial update). |

**Payload:**

```json
{
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "skin_tone": "#D2A67A",
  "hair_color": "#3B2219",
  "eye_color": "#4A90D9"
}
```

| Field | Type | Set by | Notes |
|---|---|---|---|
| `user_id` | `UUID` | server | |
| `skin_tone` | `string` | client | Hex colour. Optional. |
| `hair_color` | `string` | client | Hex colour. Optional. |
| `eye_color` | `string` | client | Hex colour. Optional. |

---

## 10. Safety

### `safety_panic`

| | |
|---|---|
| Direction | C -> S |
| Description | Panic button activated. Triggers server-side safety protocol. |

**Payload:**

```json
{
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "location": "booth",
  "timestamp": 1706745600000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `user_id` | `UUID` | yes | |
| `session_id` | `UUID` | no | If triggered during a companion session. |
| `location` | `string` | no | `"booth"`, `"lounge"`, etc. |
| `timestamp` | `int64` | yes | Unix ms. |

### `safety_block`

| | |
|---|---|
| Direction | C -> S |
| Description | Block a user. Server processes the block and may terminate active sessions/calls. |

**Payload:**

```json
{
  "blocked_user_id": "770e8400-e29b-41d4-a716-446655440000",
  "reason": "harassment"
}
```

| Field | Type | Required |
|---|---|---|
| `blocked_user_id` | `UUID` | yes |
| `reason` | `string` | no |

### `safety_unblock`

| | |
|---|---|
| Direction | C -> S |
| Description | Unblock a previously blocked user. |

**Payload:**

```json
{
  "unblocked_user_id": "770e8400-e29b-41d4-a716-446655440000"
}
```

### `safety_report`

| | |
|---|---|
| Direction | C -> S |
| Description | Report a user for policy violation. Server responds with a report confirmation. |

**Payload (C -> S):**

```json
{
  "reported_user_id": "770e8400-e29b-41d4-a716-446655440000",
  "category": "harassment",
  "reason": "Sending threatening messages",
  "description": "User sent multiple threatening messages after I declined a call.",
  "evidence_urls": [
    "https://cdn.dryft.site/evidence/screenshot1.png"
  ],
  "session_id": "aa0e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `reported_user_id` | `UUID` | yes | |
| `category` | `string` | yes | `"harassment"`, `"inappropriate"`, `"spam"`, `"other"`. |
| `reason` | `string` | yes | Brief summary. |
| `description` | `string` | no | Detailed description. |
| `evidence_urls` | `string[]` | no | |
| `session_id` | `UUID` | no | If the report relates to a companion session. |

**Server response** (delivered as a separate `safety_report` S -> C):

```json
{
  "report_id": "rpt_abc123",
  "status": "received",
  "message": "Thank you. Our team will review this report."
}
```

| Field | Type |
|---|---|
| `report_id` | `string` |
| `status` | `string` |
| `message` | `string` |

`status` values: `"received"`, `"reviewing"`, `"resolved"`.

### `safety_warning`

| | |
|---|---|
| Direction | S -> C |
| Description | Moderation warning pushed to a user. |

**Payload:**

```json
{
  "user_id": "bb0e8400-e29b-41d4-a716-446655440000",
  "type": "warning",
  "reason": "Inappropriate language",
  "message": "You have received a warning for inappropriate language. Repeated violations may result in suspension.",
  "expires_at": 1706832000000
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `user_id` | `UUID` | yes | |
| `type` | `string` | yes | `"warning"`, `"strike"`, `"suspension"`. |
| `reason` | `string` | yes | |
| `message` | `string` | yes | Human-readable message shown to the user. |
| `expires_at` | `int64` | no | Unix ms. When the action expires (relevant for suspensions). |

---

## Event Quick Reference

| Event Name | Direction | Section |
|---|---|---|
| `ping` | C -> S | Session |
| `pong` | S -> C | Session |
| `error` | S -> C | Session |
| `subscribe` | C -> S | Chat |
| `unsubscribe` | C -> S | Chat |
| `send_message` | C -> S | Chat |
| `message_sent` | S -> C | Chat |
| `new_message` | S -> C | Chat |
| `typing_start` | C -> S | Chat |
| `typing_stop` | C -> S | Chat |
| `typing` | S -> C | Chat |
| `mark_read` | C -> S | Chat |
| `messages_read` | S -> C | Chat |
| `presence` | S -> C | Presence |
| `new_match` | S -> C | Matching |
| `unmatched` | S -> C | Matching |
| `call_request` | Bi | Calls |
| `call_accept` | Bi | Calls |
| `call_reject` | Bi | Calls |
| `call_end` | Bi | Calls |
| `call_busy` | Bi | Calls |
| `call_offer` | Bi | Calls |
| `call_answer` | Bi | Calls |
| `call_candidate` | Bi | Calls |
| `call_mute` | Bi | Calls |
| `call_unmute` | Bi | Calls |
| `call_video_off` | Bi | Calls |
| `call_video_on` | Bi | Calls |
| `haptic_command` | Bi | Haptic |
| `haptic_device_status` | Bi | Haptic |
| `haptic_permission_request` | C -> S | Haptic |
| `haptic_permission_response` | Bi | Haptic |
| `haptic_stop` | Bi | Haptic |
| `session_join` | C -> S | Session (Companion) |
| `session_joined` | S -> C | Session (Companion) |
| `session_leave` | C -> S | Session (Companion) |
| `session_user_joined` | S -> C | Session (Companion) |
| `session_user_left` | S -> C | Session (Companion) |
| `session_state` | S -> C | Session (Companion) |
| `session_chat` | Bi | Session (Companion) |
| `session_haptic` | Bi | Session (Companion) |
| `session_reaction` | Bi | Session (Companion) |
| `session_ended` | S -> C | Session (Companion) |
| `voice_join` | C -> S | Voice |
| `voice_joined` | S -> C | Voice |
| `voice_leave` | C -> S | Voice |
| `voice_speaking` | Bi | Voice |
| `voice_participant_joined` | S -> C | Voice |
| `voice_participant_left` | S -> C | Voice |
| `voice_mute` | Bi | Voice |
| `voice_error` | S -> C | Voice |
| `avatar_update` | Bi | Avatar |
| `avatar_equip` | Bi | Avatar |
| `avatar_unequip` | Bi | Avatar |
| `avatar_emote` | Bi | Avatar |
| `avatar_colors` | Bi | Avatar |
| `safety_panic` | C -> S | Safety |
| `safety_block` | C -> S | Safety |
| `safety_unblock` | C -> S | Safety |
| `safety_report` | Bi | Safety |
| `safety_warning` | S -> C | Safety |

---

## Payload Schema Summary (All Events)

This section provides a compact schema reference for every event type.

| Event | Payload Fields |
|---|---|
| `ping` | none |
| `pong` | none |
| `error` | `code`, `message` |
| `subscribe` | `conversation_id` |
| `unsubscribe` | `conversation_id` |
| `send_message` | `conversation_id`, `type`, `content`, `client_id?` |
| `message_sent` | `id`, `conversation_id`, `client_id?`, `created_at` |
| `new_message` | `id`, `conversation_id`, `sender_id`, `type`, `content`, `created_at` |
| `typing_start` | `conversation_id` |
| `typing_stop` | `conversation_id` |
| `typing` | `conversation_id`, `user_id`, `is_typing` |
| `mark_read` | `conversation_id` |
| `messages_read` | `conversation_id`, `reader_id`, `read_at` |
| `presence` | `user_id`, `is_online`, `last_seen?` |
| `new_match` | `match_id`, `conversation_id`, `user`, `matched_at` |
| `unmatched` | `match_id`, `conversation_id` |
| `call_request` (C -> S) | `call_id`, `target_user_id`, `match_id?`, `video_enabled?` |
| `call_request` (S -> C) | `call_id`, `caller_id`, `caller_name`, `caller_photo?`, `video_enabled`, `match_id` |
| `call_accept` | `call_id`, `target_user_id` (client) → `call_id` (server relay) |
| `call_reject` | `call_id`, `target_user_id`, `reason?` → relay without `target_user_id` |
| `call_end` | `call_id`, `target_user_id`, `reason?` → relay without `target_user_id` |
| `call_busy` | `call_id`, `target_user_id` → relay without `target_user_id` |
| `call_offer` | `call_id`, `target_user_id`, `sdp` → relay without `target_user_id` |
| `call_answer` | `call_id`, `target_user_id`, `sdp` → relay without `target_user_id` |
| `call_candidate` | `call_id`, `target_user_id`, `candidate` → relay without `target_user_id` |
| `call_mute` | `call_id`, `target_user_id` → relay without `target_user_id` |
| `call_unmute` | `call_id`, `target_user_id` → relay without `target_user_id` |
| `call_video_off` | `call_id`, `target_user_id` → relay without `target_user_id` |
| `call_video_on` | `call_id`, `target_user_id` → relay without `target_user_id` |
| `haptic_command` | `target_user_id`, `command_type`, `intensity?`, `duration_ms?`, `pattern_name?` |
| `haptic_device_status` | `user_id`, `device_connected`, `device_name?` |
| `haptic_permission_request` | `target_user_id`, `match_id` |
| `haptic_permission_response` | `requester_id`, `permission_type`, `max_intensity?`, `granted` |
| `haptic_stop` | `target_user_id` |
| `session_join` | `session_code`, `display_name?` |
| `session_joined` | `session_id`, `session_code`, `host`, `participants`, `vr_state?` |
| `session_leave` | `session_id` |
| `session_user_joined` | `session_id`, `user` |
| `session_user_left` | `session_id`, `user_id`, `reason?` |
| `session_state` | `session_id`, `user_id`, `avatar_position?`, `avatar_rotation?`, `head_position?`, `left_hand_pos?`, `right_hand_pos?`, `current_activity?`, `current_room?`, `haptic_device_connected`, `haptic_device_name?`, `haptic_intensity?` |
| `session_chat` | `session_id`, `content` (server adds `user_id`, `display_name`, `timestamp`) |
| `session_haptic` | `session_id`, `to_user_id`, `command_type`, `intensity?`, `duration_ms?`, `pattern_name?` (server adds `from_user_id`) |
| `session_reaction` | `session_id`, `reaction_type` (server adds `user_id`) |
| `session_ended` | `session_id`, `reason` |
| `voice_join` | `session_id` |
| `voice_joined` | `session_id`, `participants` |
| `voice_leave` | `session_id` |
| `voice_speaking` | `session_id`, `speaking` (server adds `user_id`) |
| `voice_participant_joined` | `session_id`, `user_id`, `display_name` |
| `voice_participant_left` | `session_id`, `user_id` |
| `voice_mute` | `session_id`, `muted` (server adds `user_id`) |
| `voice_error` | `session_id?`, `error`, `code?` |
| `avatar_update` | `equipped_avatar_id?`, `equipped_outfit_id?`, `equipped_effect_id?`, `skin_tone?`, `hair_color?`, `eye_color?`, `display_name?`, `is_visible` (server adds `user_id`) |
| `avatar_equip` | `item_id`, `item_type` (server adds `user_id`) |
| `avatar_unequip` | `item_type` (server adds `user_id`) |
| `avatar_emote` | `emote_id` (server adds `user_id`) |
| `avatar_colors` | `skin_tone?`, `hair_color?`, `eye_color?` (server adds `user_id`) |
| `safety_panic` | `user_id`, `session_id?`, `location?`, `timestamp` |
| `safety_block` | `blocked_user_id`, `reason?` |
| `safety_unblock` | `unblocked_user_id` |
| `safety_report` | `reported_user_id`, `category`, `reason`, `description?`, `evidence_urls?`, `session_id?` |
| `safety_warning` | `user_id`, `type`, `reason`, `message`, `expires_at?` |

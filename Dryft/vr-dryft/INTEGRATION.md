# Dryft VR Integration Flow

This document explains how the VR app integrates with mobile/web clients and the backend.

## High-Level Flow

1. **Match on mobile/web** -> users connect via standard matching/chat flows.
2. **Companion session created** -> backend creates a session and issues a code.
3. **VR client broadcasts state** -> position, activity, and haptic status are streamed via WebSocket.
4. **Mobile/web companions join** -> companions join with the session code and receive updates.

## Backend Interfaces

- **REST**: `POST /v1/sessions` (create) and `POST /v1/sessions/join` (join by code)
- **WebSocket**: `/v1/ws` for real-time session events

Session events are defined in `backend/WEBSOCKET_EVENTS.md`:
- `session_join`, `session_joined`
- `session_state`
- `session_chat`
- `session_haptic`
- `session_user_joined`, `session_user_left`
- `session_ended`

## Mobile/Web Companion Clients

- **Mobile**: `mobile/src/api/session.ts` and hooks in `mobile/src/hooks/useCompanionSession.ts`
- **Web**: `web/src/hooks/useCompanionSession.ts`

Companions can:
- Send chat messages (`session_chat`).
- Send haptic commands (`session_haptic`).
- Set haptic permissions (`/v1/sessions/{id}/haptic-permission`).

## VR Client Responsibilities

The VR client should:

- Authenticate and open a WebSocket connection.
- Join or create a companion session.
- Broadcast state updates (`session_state`) at a reasonable tick rate.
- Consume session chat and haptic events.

Relevant script areas (Unity):
- `Assets/Scripts/Networking/`
- `Assets/Scripts/Session/` (if present)
- `Assets/Scripts/Haptics/`
- `Assets/Scripts/Voice/`

## Haptics

Haptic control is available both via session commands and user-level device permissions:

- **Session haptics**: `session_haptic` events
- **Device permissions**: `/v1/sessions/{sessionId}/haptic-permission`

## Voice

Voice chat uses WebSocket events defined under the **Voice** section in
`backend/WEBSOCKET_EVENTS.md` (e.g., `voice_join`, `voice_speaking`).

## Deep Links

VR invite links can be shared to mobile/web clients:

- `dryft://vr/invite/:inviteCode`
- `https://dryft.site/vr/invite/:inviteCode`

See `mobile/DEEP_LINKS.md` for exact handling.

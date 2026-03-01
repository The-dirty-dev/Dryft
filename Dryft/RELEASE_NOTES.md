# Dryft v1.0 Release Notes (Draft)

Target Release: February 2026 (final date TBD)

## Highlights

- Full rebrand launch milestone: Drift -> Dryft (`dryft.site`, `api.dryft.site`, `dryft://`).
- Verified adult community with age and ID checks.
- Real-time chat, voice, and video calls.
- Companion mode for VR sessions with mobile control.
- Haptic device support via Intiface integration.
- Virtual marketplace for avatars, outfits, and effects.
- Safety tooling (block, report, panic) and moderation workflows.

## Feature Overview

- **Matching and Discovery**: Swipe-based discovery with profile preferences and verified users.
- **Messaging**: One-to-one chat, typing indicators, read states, and rich media.
- **Calls**: WebRTC-based voice and video calling with call history.
- **Companion Sessions (VR)**: Session invites, participant presence, and shared haptic controls.
- **Marketplace and Subscriptions**: In-app purchases, entitlements, and creator content.
- **Safety and Verification**: Age gate, ID checks, and moderation reporting.
- **Notifications**: Push notifications for matches, messages, and session updates.

## System Requirements

- **Mobile**: iOS or Android device with camera/microphone access.
- **Web**: Modern desktop browser with WebRTC support.
- **Desktop**: macOS, Windows, or Linux (Electron build).
- **VR**: Meta Quest or PC VR (Unity client).
- **Network**: Reliable broadband connection recommended for calls and VR sessions.

## Known Issues and Limitations

- **VR distribution**: VR builds are delivered via sideloading (SideQuest) until store listings are approved.
- **Haptics**: Local haptic control requires Intiface Central running on the same machine.
- **Localization**: Some locales (it, ko, zh-CN) may show partial English strings until translations are finalized.
- **Web push**: Notifications require HTTPS in production and may be blocked by browser settings.

## Documentation Pointers

- Setup and configuration: `docs/ENVIRONMENT.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Operations: `RUNBOOK.md`
- API versioning: `docs/API_VERSIONING.md`

# Privacy Policy Review Notes

This review compares `docs/legal/PRIVACY_POLICY.md` against current product behavior and backend capabilities.

## Coverage OK

The policy already covers:
- Account info (email, display name, profile photo, bio)
- Verification data (age/ID via third parties)
- Payments via Stripe
- Preferences and settings
- Messages and support communications
- Device info, usage data, IP/logs
- VR telemetry (positions/interactions)
- Sharing with providers (Stripe, verification, cloud, analytics)
- Retention windows and security measures

## Remaining Gaps / Clarifications

The privacy policy now explicitly mentions push tokens, haptic metadata, call/session metadata, and analytics events. Remaining items to confirm or add:

- **Invite/link tracking** (VR invites, share links, referral codes).
- **Retention specifics** for call history and session chat, if stored.

## Suggested Actions

1. Confirm whether session chat is retained and for how long.
2. Clarify retention for call history if stored server-side.
3. Replace placeholder address in the policy if required before launch.

# Dryft Mobile Deep Links

This document lists all supported deep link routes and where they are handled in code.

## Prefixes

Deep links are accepted from:

- `dryft://`
- `https://dryft.site`
- `https://www.dryft.site`
- `https://link.dryft.site`

Source of truth:
- `mobile/src/navigation/linking.ts`
- `mobile/src/services/deepLinking.ts`

## Core Routes

| Route | Example | Destination | Code Location |
|---|---|---|---|
| `login` | `dryft://login` | Login screen | `navigation/linking.ts` |
| `register` | `dryft://register` | Register screen | `navigation/linking.ts` |
| `reset-password/:token` | `dryft://reset-password/abc` | Reset password | `navigation/linking.ts`, `deepLinking.ts` |
| `verify-email/:token` | `dryft://verify-email/abc` | Verify email | `navigation/linking.ts`, `deepLinking.ts` |
| `discover` | `dryft://discover` | Discovery tab | `navigation/linking.ts` |
| `matches` | `dryft://matches` | Matches list | `navigation/linking.ts` |
| `chat/:matchId` | `dryft://chat/123` | Match chat | `navigation/linking.ts`, `deepLinking.ts` |
| `profile` | `dryft://profile` | My profile | `navigation/linking.ts` |
| `profile/edit` | `dryft://profile/edit` | Edit profile | `navigation/linking.ts` |
| `profile/:userId` | `dryft://profile/123` | View profile | `navigation/linking.ts`, `deepLinking.ts` |
| `settings` | `dryft://settings` | Settings | `navigation/linking.ts` |
| `settings/:section` | `dryft://settings/privacy` | Settings section | `navigation/linking.ts`, `deepLinking.ts` |
| `verify/:type` | `dryft://verify/photo` | Verification flow | `navigation/linking.ts`, `deepLinking.ts` |
| `vr/invite/:inviteCode` | `dryft://vr/invite/ABC123` | VR invite | `navigation/linking.ts`, `deepLinking.ts` |
| `vr/room/:roomId` | `dryft://vr/room/room123` | VR room | `navigation/linking.ts`, `deepLinking.ts` |
| `share/:type/:id` | `dryft://share/profile/123` | Share handler | `navigation/linking.ts`, `deepLinking.ts` |

## Extended Routes (Service Parsing)

The deep link service supports additional routes for marketing and promos:

| Route | Example | Notes | Code Location |
|---|---|---|---|
| `match/:matchId` | `dryft://match/123` | Alternate match route | `deepLinking.ts` |
| `r/:referralCode` | `dryft://r/ABCD` | Referral | `deepLinking.ts` |
| `referral/:referralCode` | `dryft://referral/ABCD` | Referral | `deepLinking.ts` |
| `promo/:promoCode` | `dryft://promo/SAVE20` | Promo | `deepLinking.ts` |
| `subscribe/:plan?` | `dryft://subscribe/premium` | Subscription | `deepLinking.ts` |
| `onboarding/:step` | `dryft://onboarding/step1` | Onboarding | `deepLinking.ts` |

## Notification Links

Notification taps can navigate via URLs built in `mobile/src/navigation/linking.ts`:

- Matches: `dryft://matches` or `dryft://chat/:matchId`
- Messages: `dryft://chat/:matchId`
- Likes: `dryft://discover`
- VR invite: `dryft://vr/invite/:inviteCode`

Helper: `buildNotificationUrl()` in `navigation/linking.ts`.

## Handling Flow

1. React Navigation linking config parses URLs.
2. `deepLinkService` parses URLs for additional routing and attribution.
3. `useDeepLinkHandler()` routes to the correct screen when a link is received.

Relevant files:
- `mobile/src/navigation/linking.ts`
- `mobile/src/services/deepLinking.ts`

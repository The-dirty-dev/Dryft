# Dryft Mobile App

Dryft is a next-generation VR dating platform that connects people through immersive virtual experiences. This is the React Native mobile app built with Expo.

## Features

### Core Features
- **Discovery & Matching** - Swipe-based matching with advanced filters
- **Real-time Chat** - Text, voice messages, images, and link previews
- **Video Calls** - WebRTC-powered video and voice calls
- **Stories** - 24-hour ephemeral content with stickers and polls
- **Map View** - Location-based discovery with clustering

### VR Integration
- **Companion Mode** - Join VR sessions via session codes or invite links
- **Haptic Feedback** - Intiface integration for haptic devices
- **Virtual Marketplace** - Buy and sell avatars, outfits, and effects

### Safety & Security
- **Liveness Detection** - Face verification with challenge detection
- **Two-Factor Auth** - SMS, email, authenticator, and biometric
- **Block & Report** - Comprehensive moderation tools
- **Safety Center** - Emergency contacts, location sharing, scam detection

### Creator Tools
- **Creator Dashboard** - Analytics, earnings, and audience insights
- **Profile Boost** - Increase visibility with boosts and spotlights
- **Virtual Gifts** - Send and receive animated gifts

## Tech Stack

- **Framework**: React Native with Expo SDK 50
- **Language**: TypeScript
- **Navigation**: React Navigation 6
- **State Management**: Zustand
- **Styling**: StyleSheet with dark theme
- **i18n**: i18next with 9 locales (some partial translations)
- **Testing**: Jest with React Native Testing Library

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator
- EAS CLI for builds (`npm install -g eas-cli`)

## Getting Started

### 1. Clone and Install

```bash
cd mobile
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:
- `EXPO_PUBLIC_API_URL` - Backend API URL
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- Google Maps API keys for map features

### 3. Start Development Server

```bash
npm start
```

This opens Expo DevTools. From there you can:
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app on your device

### 4. Run on Specific Platform

```bash
# iOS
npm run ios

# Android
npm run android

# Web (limited support)
npm run web
```

## Project Structure

```
src/
├── api/              # API client and endpoint modules
├── components/       # Reusable UI components
│   ├── chat/         # Chat-related components
│   ├── moderation/   # Block/report components
│   ├── safety/       # Safety feature components
│   └── verification/ # Verification UI
├── hooks/            # Custom React hooks
├── i18n/             # Internationalization
│   └── locales/      # Translation files
├── navigation/       # React Navigation setup + deep linking
├── screens/          # Screen components
├── services/         # Business logic services
├── store/            # Zustand stores
├── types/            # TypeScript types
└── utils/            # Utility functions
```

## Zustand Stores

The app uses 8 Zustand stores in `mobile/src/store/`:

- `authStore.ts` - Auth session, tokens, user bootstrap
- `marketplaceStore.ts` - Store browsing, inventory, purchases
- `matchingStore.ts` - Discover feed, swipes, matches
- `offlineStore.ts` - Offline flags/queues and network state
- `onboardingStore.ts` - Onboarding progress and profile setup
- `settingsStore.ts` - User settings (notifications, privacy, VR, etc.)
- `subscriptionStore.ts` - Subscription status and entitlements
- `verificationStore.ts` - Age/ID verification status and steps

## API Modules

API access is centralized in `mobile/src/api/client.ts` and grouped into modules:

- `auth.ts` - Login, registration, tokens
- `haptic.ts` - Haptic device discovery and commands
- `marketplace.ts` - Store items, purchases, inventory
- `session.ts` - Companion/VR sessions and haptic permissions
- `settings.ts` - User settings read/write
- `client.ts` - Base client, request helpers, auth injection

## Internationalization (i18n)

- i18next is configured under `mobile/src/i18n`.
- Locales: `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `pt`, `zh-CN`.
- Translation files live in `mobile/src/i18n/locales/`.
- Note: `it`, `ko`, and `zh-CN` are still being finalized and may contain English strings.

## Deep Linking

Deep link config and parsing live in:
- `mobile/src/navigation/linking.ts` (React Navigation linking config)
- `mobile/src/services/deepLinking.ts` (parsing, generation, deferred links)

Supported prefixes include `dryft://`, `https://dryft.site`, `https://www.dryft.site`, and `https://link.dryft.site`.

Key routes:
- `dryft://chat/:matchId`
- `dryft://vr/invite/:inviteCode`
- `dryft://vr/room/:roomId`
- `dryft://profile/:userId`
- `dryft://settings/:section`
- `dryft://verify/:type`

## Companion / VR Session Flow

- A user creates or joins a session using a session code or invite link.
- Mobile clients join via `POST /v1/sessions/join` and receive a session payload.
- During the session, participants can:
  - Chat via `POST /v1/sessions/{sessionId}/chat`.
  - Send haptic commands via `POST /v1/sessions/{sessionId}/haptic`.
  - Set haptic permissions via `POST /v1/sessions/{sessionId}/haptic-permission`.
- Leaving a session uses `POST /v1/sessions/{sessionId}/leave`.

## Available Scripts

```bash
# Development
npm start             # Start Expo dev server
npm run ios           # Run on iOS
npm run android       # Run on Android

# Quality
npm run lint          # Run ESLint
npm run typecheck     # Run TypeScript check
npm test              # Run tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Building
npm run prebuild      # Generate native projects
npm run build:dev     # EAS development build
npm run build:preview # EAS preview build
npm run build:production # EAS production build
```

## Testing

```bash
# Run all tests
npm test

# Run a single test file
npm test -- src/__tests__/notifications.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Tests are located in `src/__tests__/` with setup in `src/__tests__/setup.ts`.

## Internationalization

The app supports 9 locales:
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Japanese (ja)
- Korean (ko)
- Portuguese (pt)
- Chinese (Simplified, zh-CN)

Translation files are in `src/i18n/locales/`.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run lint` and `npm run typecheck`
4. Run `npm test`
5. Submit a pull request

## Troubleshooting

### Metro bundler issues
```bash
npx expo start --clear
```

### iOS build issues
```bash
cd ios && pod install && cd ..
```

### Android build issues
```bash
cd android && ./gradlew clean && cd ..
```

### Expo cache issues
```bash
expo r -c
```

## License

Proprietary - All rights reserved.

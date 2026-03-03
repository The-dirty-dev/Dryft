// API Configuration
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

// WebSocket Configuration
const DEFAULT_WS_URL = __DEV__
  ? 'ws://localhost:8080/v1/ws'
  : 'ws://api.dryft.site:8080/v1/ws';

// Temporary production default while DreamHost websocket proxy headers are pending.
// Override with EXPO_PUBLIC_WS_URL=wss://api.dryft.site/v1/ws once proxy support is fixed.
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL || DEFAULT_WS_URL;
export const WS_ORIGIN_URL = WS_BASE_URL.replace(/\/v1\/ws\/?$/, '');

// Timeouts
export const REQUEST_TIMEOUT = 30000; // 30 seconds
export const WS_RECONNECT_DELAY = 3000; // 3 seconds
export const WS_PING_INTERVAL = 30000; // 30 seconds

// Feature Flags
export const ENABLE_ANALYTICS = process.env.EXPO_PUBLIC_ENABLE_ANALYTICS !== 'false';
export const ENABLE_CRASH_REPORTING = process.env.EXPO_PUBLIC_ENABLE_CRASH_REPORTING !== 'false';

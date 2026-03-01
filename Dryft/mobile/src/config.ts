// API Configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

// WebSocket Configuration
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

// Timeouts
export const REQUEST_TIMEOUT = 30000; // 30 seconds
export const WS_RECONNECT_DELAY = 3000; // 3 seconds
export const WS_PING_INTERVAL = 30000; // 30 seconds

// Feature Flags
export const ENABLE_ANALYTICS = process.env.EXPO_PUBLIC_ENABLE_ANALYTICS !== 'false';
export const ENABLE_CRASH_REPORTING = process.env.EXPO_PUBLIC_ENABLE_CRASH_REPORTING !== 'false';

// K6 Load Test Script for Drift API
// Run with: k6 run --vus 50 --duration 5m load-test.js
// Or: k6 run --config load-test-config.json load-test.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = __ENV.API_URL || 'http://localhost:8080';
const TEST_EMAIL_PREFIX = 'loadtest';
const TEST_PASSWORD = 'TestPassword123!';

// Custom metrics
const errorRate = new Rate('errors');
const authLatency = new Trend('auth_latency');
const matchingLatency = new Trend('matching_latency');
const chatLatency = new Trend('chat_latency');
const apiCallCount = new Counter('api_calls');

// Test options - can be overridden via CLI or config file
export const options = {
  scenarios: {
    // Warm-up: gradual ramp
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
      ],
      gracefulRampDown: '10s',
    },
    // Sustained load
    sustained: {
      executor: 'constant-vus',
      vus: 50,
      duration: '3m',
      startTime: '1m30s',
    },
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 50 },
      ],
      startTime: '4m30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.05'],
    auth_latency: ['p(95)<300'],
    matching_latency: ['p(95)<400'],
    chat_latency: ['p(95)<200'],
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

function randomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

// =============================================================================
// Test Functions
// =============================================================================

// Register a new test user
function registerUser() {
  const email = `${TEST_EMAIL_PREFIX}_${randomString(8)}@loadtest.dryft.site`;
  const payload = JSON.stringify({
    email: email,
    password: TEST_PASSWORD,
    display_name: `LoadTest User ${randomString(4)}`,
  });

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/v1/auth/register`, payload, {
    headers: jsonHeaders(),
    tags: { name: 'register' },
  });
  authLatency.add(Date.now() - startTime);
  apiCallCount.add(1);

  const success = check(res, {
    'register: status is 201': (r) => r.status === 201,
    'register: has token': (r) => {
      try {
        return JSON.parse(r.body).token !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  if (success) {
    try {
      const body = JSON.parse(res.body);
      return { token: body.token, refreshToken: body.refresh_token, email };
    } catch {
      return null;
    }
  }
  return null;
}

// Login with existing user
function loginUser(email) {
  const payload = JSON.stringify({
    email: email,
    password: TEST_PASSWORD,
  });

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/v1/auth/login`, payload, {
    headers: jsonHeaders(),
    tags: { name: 'login' },
  });
  authLatency.add(Date.now() - startTime);
  apiCallCount.add(1);

  const success = check(res, {
    'login: status is 200': (r) => r.status === 200,
    'login: has token': (r) => {
      try {
        return JSON.parse(r.body).token !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  if (success) {
    try {
      return JSON.parse(res.body).token;
    } catch {
      return null;
    }
  }
  return null;
}

// Get current user profile
function getCurrentUser(token) {
  const res = http.get(`${BASE_URL}/v1/users/me`, {
    headers: authHeaders(token),
    tags: { name: 'get_profile' },
  });
  apiCallCount.add(1);

  const success = check(res, {
    'get profile: status is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);
  return success;
}

// Discover profiles (matching)
function discoverProfiles(token) {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/v1/discover?limit=10`, {
    headers: authHeaders(token),
    tags: { name: 'discover' },
  });
  matchingLatency.add(Date.now() - startTime);
  apiCallCount.add(1);

  const success = check(res, {
    'discover: status is 200 or 403': (r) =>
      r.status === 200 || r.status === 403, // 403 if not verified
  });
  errorRate.add(!success);
  return success;
}

// Get matches
function getMatches(token) {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/v1/matches?limit=20`, {
    headers: authHeaders(token),
    tags: { name: 'get_matches' },
  });
  matchingLatency.add(Date.now() - startTime);
  apiCallCount.add(1);

  const success = check(res, {
    'get matches: status is 200 or 403': (r) =>
      r.status === 200 || r.status === 403,
  });
  errorRate.add(!success);
  return success;
}

// Get conversations
function getConversations(token) {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/v1/conversations?limit=20`, {
    headers: authHeaders(token),
    tags: { name: 'get_conversations' },
  });
  chatLatency.add(Date.now() - startTime);
  apiCallCount.add(1);

  const success = check(res, {
    'get conversations: status is 200 or 403': (r) =>
      r.status === 200 || r.status === 403,
  });
  errorRate.add(!success);
  return success;
}

// Health check
function healthCheck() {
  const res = http.get(`${BASE_URL}/health`, {
    tags: { name: 'health' },
  });
  apiCallCount.add(1);

  const success = check(res, {
    'health: status is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);
  return success;
}

// Ready check
function readyCheck() {
  const res = http.get(`${BASE_URL}/ready`, {
    tags: { name: 'ready' },
  });
  apiCallCount.add(1);

  const success = check(res, {
    'ready: status is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);
  return success;
}

// Store items (public endpoint)
function getStoreItems() {
  const res = http.get(`${BASE_URL}/v1/store/items?limit=20`, {
    headers: jsonHeaders(),
    tags: { name: 'store_items' },
  });
  apiCallCount.add(1);

  const success = check(res, {
    'store items: status is 200': (r) => r.status === 200,
  });
  errorRate.add(!success);
  return success;
}

// =============================================================================
// Main Test Flow
// =============================================================================

export default function () {
  // Always start with health checks
  group('Health Checks', () => {
    healthCheck();
    readyCheck();
  });

  // Register or simulate authentication
  let authData = null;
  group('Authentication', () => {
    authData = registerUser();
    if (!authData) {
      // If registration fails (maybe duplicate), try with random
      authData = registerUser();
    }
  });

  // Skip authenticated tests if no auth
  if (!authData || !authData.token) {
    sleep(1);
    return;
  }

  // User profile operations
  group('User Profile', () => {
    getCurrentUser(authData.token);
    sleep(0.5);
  });

  // Matching operations (may fail if not verified)
  group('Matching', () => {
    discoverProfiles(authData.token);
    sleep(0.3);
    getMatches(authData.token);
    sleep(0.3);
  });

  // Chat operations (may fail if not verified)
  group('Chat', () => {
    getConversations(authData.token);
    sleep(0.3);
  });

  // Store (public)
  group('Store', () => {
    getStoreItems();
    sleep(0.2);
  });

  // Think time between iterations
  sleep(Math.random() * 2 + 1);
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

  // Verify API is reachable
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: ${healthRes.status}`);
  }

  console.log('API is healthy, starting test...');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)}s`);
}

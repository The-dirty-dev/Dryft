// K6 WebSocket Load Test Script for Drift Real-time
// Run with: k6 run --vus 25 --duration 3m load-test-websocket.js
// Requires k6 with WebSocket support

import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = __ENV.API_URL || 'http://localhost:8080';
const WS_URL = __ENV.WS_URL || 'ws://localhost:8080';
const TEST_EMAIL_PREFIX = 'wstest';
const TEST_PASSWORD = 'TestPassword123!';

// Custom metrics
const wsConnectionTime = new Trend('ws_connection_time');
const wsMessageLatency = new Trend('ws_message_latency');
const wsErrors = new Rate('ws_errors');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsMessagesSent = new Counter('ws_messages_sent');

export const options = {
  scenarios: {
    websocket_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '1m', target: 25 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connection_time: ['p(95)<1000'],
    ws_message_latency: ['p(95)<500'],
    ws_errors: ['rate<0.1'],
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

// Register and get auth token
function getAuthToken() {
  const email = `${TEST_EMAIL_PREFIX}_${randomString(8)}@wstest.dryft.site`;
  const payload = JSON.stringify({
    email: email,
    password: TEST_PASSWORD,
    display_name: `WS Test ${randomString(4)}`,
  });

  const res = http.post(`${BASE_URL}/v1/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 201) {
    try {
      return JSON.parse(res.body).token;
    } catch {
      return null;
    }
  }
  return null;
}

// =============================================================================
// WebSocket Test
// =============================================================================

export default function () {
  // Get auth token first
  const token = getAuthToken();
  if (!token) {
    console.log('Failed to get auth token, skipping WebSocket test');
    sleep(1);
    return;
  }

  const wsEndpoint = `${WS_URL}/v1/ws?token=${token}`;
  const connectionStart = Date.now();

  const res = ws.connect(wsEndpoint, {}, function (socket) {
    const connectionTime = Date.now() - connectionStart;
    wsConnectionTime.add(connectionTime);

    socket.on('open', function () {
      console.log(`WebSocket connected in ${connectionTime}ms`);

      // Send presence update
      socket.send(
        JSON.stringify({
          type: 'presence',
          payload: { status: 'online' },
        })
      );
      wsMessagesSent.add(1);

      // Send periodic pings
      socket.setInterval(function () {
        const pingStart = Date.now();
        socket.send(JSON.stringify({ type: 'ping', timestamp: pingStart }));
        wsMessagesSent.add(1);
      }, 5000);
    });

    socket.on('message', function (data) {
      wsMessagesReceived.add(1);

      try {
        const msg = JSON.parse(data);

        // Track latency for pong responses
        if (msg.type === 'pong' && msg.timestamp) {
          const latency = Date.now() - msg.timestamp;
          wsMessageLatency.add(latency);
        }
      } catch {
        // Not JSON, ignore
      }
    });

    socket.on('error', function (e) {
      console.log('WebSocket error:', e);
      wsErrors.add(1);
    });

    socket.on('close', function () {
      console.log('WebSocket disconnected');
    });

    // Keep connection open for test duration
    socket.setTimeout(function () {
      socket.send(
        JSON.stringify({
          type: 'presence',
          payload: { status: 'offline' },
        })
      );
      wsMessagesSent.add(1);
      socket.close();
    }, 60000);
  });

  const connected = check(res, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });

  if (!connected) {
    wsErrors.add(1);
  }

  // Wait between connections
  sleep(Math.random() * 3 + 2);
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

export function setup() {
  console.log(`Starting WebSocket load test against ${WS_URL}`);

  // Verify API is reachable
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`API health check failed: ${healthRes.status}`);
  }

  console.log('API is healthy, starting WebSocket test...');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`WebSocket load test completed in ${duration.toFixed(2)}s`);
}

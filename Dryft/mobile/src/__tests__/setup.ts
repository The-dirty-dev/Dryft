// Jest setup file for Dryft mobile app tests

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock @sentry/react-native
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((cb: any) => cb({ setExtra: jest.fn(), setTag: jest.fn() })),
  Severity: { Error: 'error', Warning: 'warning', Info: 'info' },
  wrap: (component: any) => component,
  ReactNativeTracing: jest.fn(),
  ReactNavigationInstrumentation: jest.fn(),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
    manifest: null,
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo-image
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// Mock Stripe React Native
jest.mock('@stripe/stripe-react-native', () => ({
  initStripe: jest.fn(),
  StripeProvider: ({ children }: { children: React.ReactNode }) => children,
  useStripe: () => ({
    presentPaymentSheet: jest.fn(),
    confirmPayment: jest.fn(),
  }),
  CardField: () => null,
}));

// Mock react-navigation
const navigationMock = {
  navigate: jest.fn(),
  setOptions: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};

(global as any).__mockNavigation = navigationMock;
(global as any).__mockRoute = { params: {} };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => (global as any).__mockNavigation,
  useRoute: () => (global as any).__mockRoute,
}));

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as jest.Mock;

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 1;
  OPEN = 1;
  CLOSED = 3;

  constructor(public url: string) {}

  send = jest.fn();
  close = jest.fn();
}

(global as any).WebSocket = MockWebSocket;

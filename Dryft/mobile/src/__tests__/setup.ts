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

// Mock react-native-purchases to avoid ESM-only dependency issues in Jest.
jest.mock('react-native-purchases', () => {
  const mockPurchases = {
    configure: jest.fn(async () => undefined),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    getOfferings: jest.fn(async () => ({ current: null, all: {} })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(async () => ({ entitlements: { active: {} } })),
    getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
    logIn: jest.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })),
    logOut: jest.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })),
  };

  return {
    __esModule: true,
    default: mockPurchases,
    ...mockPurchases,
    PRODUCT_CATEGORY: { SUBSCRIPTION: 'SUBSCRIPTION' },
    LOG_LEVEL: { DEBUG: 'DEBUG' },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaConsumer: ({ children }: { children: (insets: any) => React.ReactNode }) =>
      children({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 320, height: 640 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  };
});

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

// Mock common native modules used by untested hooks/services.
jest.mock('react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: jest.fn(async () => ({ getTracks: () => [], getAudioTracks: () => [] })) },
  RTCPeerConnection: jest.fn(() => ({
    addTrack: jest.fn(),
    createOffer: jest.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' })),
    createAnswer: jest.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' })),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
    addIceCandidate: jest.fn(),
    close: jest.fn(),
  })),
  RTCSessionDescription: jest.fn(),
  RTCIceCandidate: jest.fn(),
}));

jest.mock('react-native-callkeep', () => ({
  setup: jest.fn(async () => true),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  setAvailable: jest.fn(),
  displayIncomingCall: jest.fn(),
  startCall: jest.fn(),
  endCall: jest.fn(),
  endAllCalls: jest.fn(),
  reportEndCallWithUUID: jest.fn(),
  setMutedCall: jest.fn(),
  setOnHold: jest.fn(),
  updateDisplay: jest.fn(),
  setCurrentCallActive: jest.fn(),
}));

jest.mock('react-native-voip-push-notification', () => ({
  default: {
    registerVoipToken: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

jest.mock('expo-camera', () => ({
  Camera: { requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })) },
}));

jest.mock('expo-face-detector', () => ({
  detectFacesAsync: jest.fn(async () => ({ faces: [] })),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///tmp/',
  cacheDirectory: 'file:///tmp/cache/',
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 1024 })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  uploadAsync: jest.fn(async () => ({ status: 200, body: '{}' })),
}));

jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  createURL: jest.fn((path: string) => `dryft://${path || ''}`),
  parse: jest.fn((url: string) => ({ path: url })),
  openURL: jest.fn(async () => true),
  getInitialURL: jest.fn(async () => null),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
  unregisterTaskAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
  setMinimumIntervalAsync: jest.fn(async () => undefined),
  BackgroundFetchResult: { NewData: 'NewData', NoData: 'NoData', Failed: 'Failed' },
}));

jest.mock('expo-updates', () => ({
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({})),
  reloadAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-localization', () => ({
  locale: 'en-US',
  getLocales: jest.fn(() => [{ languageTag: 'en-US' }]),
}));

jest.mock('expo-av', () => ({
  Audio: {
    AndroidOutputFormat: { MPEG_4: 'mpeg4' },
    AndroidAudioEncoder: { AAC: 'aac' },
    IOSOutputFormat: { MPEG4AAC: 'mpeg4aac' },
    IOSAudioQuality: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' },
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    setAudioModeAsync: jest.fn(async () => undefined),
    Recording: jest.fn(() => ({
      prepareToRecordAsync: jest.fn(async () => undefined),
      startAsync: jest.fn(async () => undefined),
      stopAndUnloadAsync: jest.fn(async () => undefined),
      getURI: jest.fn(() => 'file:///tmp/audio.m4a'),
    })),
    Sound: {
      createAsync: jest.fn(async () => ({
        sound: {
          playAsync: jest.fn(async () => undefined),
          pauseAsync: jest.fn(async () => undefined),
          unloadAsync: jest.fn(async () => undefined),
          setPositionAsync: jest.fn(async () => undefined),
        },
        status: { isLoaded: true },
      })),
    },
  },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    MIN: 'min',
    LOW: 'low',
    DEFAULT: 'default',
    HIGH: 'high',
    MAX: 'max',
  },
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'expo-token' })),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  dismissNotificationAsync: jest.fn(async () => undefined),
  setBadgeCountAsync: jest.fn(async () => true),
  getBadgeCountAsync: jest.fn(async () => 0),
  scheduleNotificationAsync: jest.fn(async () => 'notif-id'),
}));

jest.mock('expo-quick-actions', () => ({
  setItems: jest.fn(),
  clearItems: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' })),
  addEventListener: jest.fn((cb: (s: any) => void) => {
    cb({ isConnected: true, isInternetReachable: true, type: 'wifi' });
    return () => undefined;
  }),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: () => ({
    requestPermission: jest.fn(async () => 1),
    getToken: jest.fn(async () => 'fcm-token'),
    onMessage: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn(async () => null),
  }),
}), { virtual: true });

jest.mock('../theme/ThemeProvider', () => {
  const React = require('react');

  const colors = {
    background: '#0f0f23',
    backgroundSecondary: '#16213e',
    surface: '#1a1a2e',
    surfaceElevated: '#252542',
    primary: '#e94560',
    primaryLight: '#ff6b8a',
    primaryDark: '#c13050',
    text: '#ffffff',
    textSecondary: '#8892b0',
    textMuted: '#5c6580',
    textInverse: '#0f0f23',
    success: '#2ecc71',
    warning: '#f39c12',
    error: '#e74c3c',
    info: '#3498db',
    border: '#2a2a4e',
    borderLight: '#3a3a5e',
    divider: '#1e1e38',
    overlay: 'rgba(0, 0, 0, 0.7)',
    like: '#2ecc71',
    superLike: '#3498db',
    pass: '#e74c3c',
    accent: '#8B5CF6',
    accentSecondary: '#6B46C1',
    accentPink: '#EC4899',
    accentYellow: '#FCD34D',
    textTertiary: '#9CA3AF',
    backgroundDarkest: '#1a1a1a',
    surfaceSecondary: '#1F1F2E',
    panic: '#ff0000',
    safetyWarning: '#ff6b6b',
  };

  const theme = {
    colors,
    isDark: true,
    isHighContrast: false,
    colorBlindMode: 'none',
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
    borderRadius: { sm: 4, md: 8, lg: 16, full: 9999 },
    typography: {
      fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
      fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
    },
  };

  return {
    __esModule: true,
    DARK_THEME_COLORS: colors,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    useTheme: () => theme,
    useColors: () => colors,
    useThemeContext: () => ({ theme, colorBlindMode: 'none', setColorBlindMode: jest.fn() }),
  };
});

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    setString: jest.fn(),
    getString: jest.fn(async () => ''),
  },
}), { virtual: true });

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

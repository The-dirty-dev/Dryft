import { Platform, NativeModules, NativeEventEmitter, AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { logger } from '@utils/logger';

// =============================================================================
// Screen Security Service
// Prevents screen capture and recording for user privacy
// =============================================================================

// Secure storage keys
const KEYS = {
  SCREEN_SECURITY_ENABLED: 'dryft_screen_security_enabled',
  BLUR_ON_SCREENSHOT: 'dryft_blur_on_screenshot',
  NOTIFY_ON_SCREENSHOT: 'dryft_notify_on_screenshot',
};

// Native module interface (for custom native implementation)
interface ScreenSecurityNativeModule {
  enableSecureMode: () => Promise<void>;
  disableSecureMode: () => Promise<void>;
  isScreenBeingCaptured: () => Promise<boolean>;
  preventScreenCapture: (prevent: boolean) => Promise<void>;
  addScreenCaptureListener: () => void;
  removeScreenCaptureListener: () => void;
}

// Check if native module is available
const ScreenSecurityNative = NativeModules.ScreenSecurity as ScreenSecurityNativeModule | undefined;

export interface ScreenSecuritySettings {
  isEnabled: boolean;
  blurOnScreenshot: boolean;
  notifyOnScreenshot: boolean;
}

export interface ScreenCaptureEvent {
  isCaptured: boolean;
  timestamp: number;
}

type ScreenCaptureCallback = (event: ScreenCaptureEvent) => void;

class ScreenSecurityService {
  private isInitialized = false;
  private isSecureModeActive = false;
  private listeners: Set<ScreenCaptureCallback> = new Set();
  private nativeEmitter: NativeEventEmitter | null = null;
  private appStateSubscription: any = null;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the screen security service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Set up native event emitter if available
      if (ScreenSecurityNative) {
        this.nativeEmitter = new NativeEventEmitter(NativeModules.ScreenSecurity);
        this.nativeEmitter.addListener('onScreenCaptureChange', this.handleCaptureChange.bind(this));
      }

      // Set up app state listener for additional security
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

      // Check settings and apply
      const settings = await this.getSettings();
      if (settings.isEnabled) {
        await this.enableSecureMode();
      }

      this.isInitialized = true;
      logger.info('Screen security service initialized');
    } catch (error) {
      logger.error('Failed to initialize screen security service:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.nativeEmitter) {
      this.nativeEmitter.removeAllListeners('onScreenCaptureChange');
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.listeners.clear();
    this.isInitialized = false;
  }

  /**
   * Enable secure mode - prevents screen capture/recording
   */
  async enableSecureMode(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        // Android: Use FLAG_SECURE
        if (ScreenSecurityNative) {
          await ScreenSecurityNative.enableSecureMode();
        } else {
          // Fallback: Use react-native's built-in secure mode if available
          await this.enableAndroidSecureFlag();
        }
      } else if (Platform.OS === 'ios') {
        // iOS: Add capture detection
        if (ScreenSecurityNative) {
          await ScreenSecurityNative.enableSecureMode();
          ScreenSecurityNative.addScreenCaptureListener();
        }
        // Start polling for screen capture on iOS (as backup)
        this.startCaptureDetection();
      }

      this.isSecureModeActive = true;
      await SecureStore.setItemAsync(KEYS.SCREEN_SECURITY_ENABLED, 'true');
      logger.info('Screen secure mode enabled');
    } catch (error) {
      logger.error('Failed to enable secure mode:', error);
      throw error;
    }
  }

  /**
   * Disable secure mode
   */
  async disableSecureMode(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        if (ScreenSecurityNative) {
          await ScreenSecurityNative.disableSecureMode();
        } else {
          await this.disableAndroidSecureFlag();
        }
      } else if (Platform.OS === 'ios') {
        if (ScreenSecurityNative) {
          await ScreenSecurityNative.disableSecureMode();
          ScreenSecurityNative.removeScreenCaptureListener();
        }
        this.stopCaptureDetection();
      }

      this.isSecureModeActive = false;
      await SecureStore.setItemAsync(KEYS.SCREEN_SECURITY_ENABLED, 'false');
      logger.info('Screen secure mode disabled');
    } catch (error) {
      logger.error('Failed to disable secure mode:', error);
      throw error;
    }
  }

  /**
   * Check if screen is currently being captured
   */
  async isScreenBeingCaptured(): Promise<boolean> {
    try {
      if (ScreenSecurityNative) {
        return await ScreenSecurityNative.isScreenBeingCaptured();
      }
      // Fallback: Cannot detect without native module
      return false;
    } catch (error) {
      logger.warn('Failed to check screen capture status:', error);
      return false;
    }
  }

  /**
   * Check if secure mode is currently active
   */
  isSecureMode(): boolean {
    return this.isSecureModeActive;
  }

  /**
   * Get current screen security settings
   */
  async getSettings(): Promise<ScreenSecuritySettings> {
    const [isEnabled, blurOnScreenshot, notifyOnScreenshot] = await Promise.all([
      SecureStore.getItemAsync(KEYS.SCREEN_SECURITY_ENABLED),
      SecureStore.getItemAsync(KEYS.BLUR_ON_SCREENSHOT),
      SecureStore.getItemAsync(KEYS.NOTIFY_ON_SCREENSHOT),
    ]);

    return {
      isEnabled: isEnabled === 'true',
      blurOnScreenshot: blurOnScreenshot !== 'false', // Default true
      notifyOnScreenshot: notifyOnScreenshot !== 'false', // Default true
    };
  }

  /**
   * Update screen security settings
   */
  async updateSettings(settings: Partial<ScreenSecuritySettings>): Promise<void> {
    if (settings.isEnabled !== undefined) {
      if (settings.isEnabled) {
        await this.enableSecureMode();
      } else {
        await this.disableSecureMode();
      }
    }

    if (settings.blurOnScreenshot !== undefined) {
      await SecureStore.setItemAsync(
        KEYS.BLUR_ON_SCREENSHOT,
        settings.blurOnScreenshot ? 'true' : 'false'
      );
    }

    if (settings.notifyOnScreenshot !== undefined) {
      await SecureStore.setItemAsync(
        KEYS.NOTIFY_ON_SCREENSHOT,
        settings.notifyOnScreenshot ? 'true' : 'false'
      );
    }
  }

  /**
   * Add listener for screen capture events
   */
  addCaptureListener(callback: ScreenCaptureCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Prevent screen capture for a specific duration (e.g., during sensitive operations)
   */
  async preventCaptureTemporarily(durationMs: number): Promise<void> {
    const wasActive = this.isSecureModeActive;

    if (!wasActive) {
      await this.enableSecureMode();
    }

    setTimeout(async () => {
      if (!wasActive) {
        await this.disableSecureMode();
      }
    }, durationMs);
  }

  // Private methods

  private handleCaptureChange(event: { isCaptured: boolean }): void {
    const captureEvent: ScreenCaptureEvent = {
      isCaptured: event.isCaptured,
      timestamp: Date.now(),
    };

    this.listeners.forEach((callback) => {
      try {
        callback(captureEvent);
      } catch (error) {
        logger.error('Error in screen capture listener:', error);
      }
    });

    if (event.isCaptured) {
      logger.warn('Screen capture detected');
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    // Additional security: could blur content when app goes to background
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App is being backgrounded - content will be hidden automatically on iOS
      // with secure mode enabled
    }
  }

  private async enableAndroidSecureFlag(): Promise<void> {
    // This requires a native module implementation
    // For Expo, we'll need to use a config plugin or bare workflow
    logger.warn('Android FLAG_SECURE requires native module');
  }

  private async disableAndroidSecureFlag(): Promise<void> {
    logger.warn('Android FLAG_SECURE requires native module');
  }

  private startCaptureDetection(): void {
    // Poll for screen capture status on iOS
    // This is a fallback if native events aren't available
    if (this.checkInterval) return;

    this.checkInterval = setInterval(async () => {
      const isCaptured = await this.isScreenBeingCaptured();
      if (isCaptured) {
        this.handleCaptureChange({ isCaptured: true });
      }
    }, 1000);
  }

  private stopCaptureDetection(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const screenSecurity = new ScreenSecurityService();

// =============================================================================
// Sensitive Screen Registry
// Track which screens should have screen security enabled
// =============================================================================

const SENSITIVE_SCREENS = new Set([
  'Chat',
  'VideoCall',
  'Profile',
  'EditProfile',
  'Matches',
  'MatchDetail',
  'Settings',
  'SecuritySettings',
  'PrivacySettings',
  'Verification',
  'IDVerification',
  'CardVerification',
  'PhotoVerification',
  'Companion',
  'PaymentMethods',
  'Checkout',
]);

/**
 * Check if a screen should have screen security enabled
 */
export function isSensitiveScreen(screenName: string): boolean {
  return SENSITIVE_SCREENS.has(screenName);
}

/**
 * Add a screen to the sensitive screens list
 */
export function registerSensitiveScreen(screenName: string): void {
  SENSITIVE_SCREENS.add(screenName);
}

/**
 * Remove a screen from the sensitive screens list
 */
export function unregisterSensitiveScreen(screenName: string): void {
  SENSITIVE_SCREENS.delete(screenName);
}

/**
 * Get all registered sensitive screens
 */
export function getSensitiveScreens(): string[] {
  return Array.from(SENSITIVE_SCREENS);
}

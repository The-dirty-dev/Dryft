/**
 * Screen Security Native Module Bridge
 *
 * This module provides a bridge between JavaScript and native code
 * for screen capture prevention and detection.
 *
 * Note: This module requires the withScreenSecurity Expo config plugin
 * to be enabled in app.json/app.config.js
 */

import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  EmitterSubscription,
} from 'react-native';

// =============================================================================
// Types
// =============================================================================

interface ScreenSecurityNativeModule {
  enableSecureMode: () => Promise<void>;
  disableSecureMode: () => Promise<void>;
  isSecureModeEnabled: () => Promise<boolean>;
  isScreenBeingCaptured: () => Promise<boolean>;
}

interface ScreenCaptureChangeEvent {
  isCaptured: boolean;
}

// =============================================================================
// Native Module Access
// =============================================================================

// The native module might not be available (e.g., in Expo Go)
const ScreenSecurityNative: ScreenSecurityNativeModule | undefined =
  NativeModules.ScreenSecurity;

// Create event emitter if native module exists
const screenSecurityEmitter = ScreenSecurityNative
  ? new NativeEventEmitter(NativeModules.ScreenSecurity)
  : null;

// =============================================================================
// API Functions
// =============================================================================

/**
 * Check if the native module is available
 */
export function isNativeModuleAvailable(): boolean {
  return ScreenSecurityNative !== undefined;
}

/**
 * Enable secure mode (FLAG_SECURE on Android, secure view on iOS)
 */
export async function enableSecureMode(): Promise<void> {
  if (Platform.OS === 'android' && ScreenSecurityNative) {
    await ScreenSecurityNative.enableSecureMode();
  } else if (Platform.OS === 'ios' && ScreenSecurityNative) {
    await ScreenSecurityNative.enableSecureMode();
  } else {
    console.warn(
      'ScreenSecurity: Native module not available. ' +
        'Make sure the withScreenSecurity plugin is enabled and you are using a development build.'
    );
  }
}

/**
 * Disable secure mode
 */
export async function disableSecureMode(): Promise<void> {
  if (ScreenSecurityNative) {
    await ScreenSecurityNative.disableSecureMode();
  }
}

/**
 * Check if secure mode is currently enabled
 */
export async function isSecureModeEnabled(): Promise<boolean> {
  if (ScreenSecurityNative) {
    return await ScreenSecurityNative.isSecureModeEnabled();
  }
  return false;
}

/**
 * Check if the screen is currently being captured/recorded
 * (iOS only - Android FLAG_SECURE prevents this automatically)
 */
export async function isScreenBeingCaptured(): Promise<boolean> {
  if (Platform.OS === 'ios' && ScreenSecurityNative) {
    return await ScreenSecurityNative.isScreenBeingCaptured();
  }
  // On Android with FLAG_SECURE, screen recording shows black screen
  // so we don't need to detect it
  return false;
}

/**
 * Add a listener for screen capture changes (iOS only)
 * @param callback Function to call when screen capture status changes
 * @returns Subscription to remove the listener
 */
export function addScreenCaptureListener(
  callback: (event: ScreenCaptureChangeEvent) => void
): EmitterSubscription | null {
  if (Platform.OS === 'ios' && screenSecurityEmitter) {
    return screenSecurityEmitter.addListener('onScreenCaptureChange', callback);
  }
  return null;
}

// =============================================================================
// Expo Go Fallback Implementation
// =============================================================================

/**
 * When running in Expo Go, native modules aren't available.
 * This provides a simulated implementation for development.
 */
class ExpoGoFallback {
  private secureModeEnabled = false;
  private listeners: Set<(event: ScreenCaptureChangeEvent) => void> = new Set();

  async enableSecureMode(): Promise<void> {
    this.secureModeEnabled = true;
    console.log('[ScreenSecurity] Secure mode enabled (simulated in Expo Go)');
  }

  async disableSecureMode(): Promise<void> {
    this.secureModeEnabled = false;
    console.log('[ScreenSecurity] Secure mode disabled (simulated in Expo Go)');
  }

  async isSecureModeEnabled(): Promise<boolean> {
    return this.secureModeEnabled;
  }

  async isScreenBeingCaptured(): Promise<boolean> {
    // Cannot detect in Expo Go
    return false;
  }

  addListener(callback: (event: ScreenCaptureChangeEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Simulate screen capture for testing
  simulateScreenCapture(isCaptured: boolean): void {
    const event: ScreenCaptureChangeEvent = { isCaptured };
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        console.error('[ScreenSecurity] Error in listener:', e);
      }
    });
  }
}

// Export fallback for development
export const expoGoFallback = new ExpoGoFallback();

// =============================================================================
// Unified API (handles both native and fallback)
// =============================================================================

export const ScreenSecurityModule = {
  isAvailable: isNativeModuleAvailable(),

  async enableSecureMode(): Promise<void> {
    if (isNativeModuleAvailable()) {
      await enableSecureMode();
    } else {
      await expoGoFallback.enableSecureMode();
    }
  },

  async disableSecureMode(): Promise<void> {
    if (isNativeModuleAvailable()) {
      await disableSecureMode();
    } else {
      await expoGoFallback.disableSecureMode();
    }
  },

  async isSecureModeEnabled(): Promise<boolean> {
    if (isNativeModuleAvailable()) {
      return await isSecureModeEnabled();
    }
    return await expoGoFallback.isSecureModeEnabled();
  },

  async isScreenBeingCaptured(): Promise<boolean> {
    if (isNativeModuleAvailable()) {
      return await isScreenBeingCaptured();
    }
    return await expoGoFallback.isScreenBeingCaptured();
  },

  addScreenCaptureListener(
    callback: (event: ScreenCaptureChangeEvent) => void
  ): (() => void) | null {
    if (isNativeModuleAvailable()) {
      const subscription = addScreenCaptureListener(callback);
      return subscription ? () => subscription.remove() : null;
    }
    return expoGoFallback.addListener(callback);
  },
};

export default ScreenSecurityModule;

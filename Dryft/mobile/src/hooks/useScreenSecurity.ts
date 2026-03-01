import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  screenSecurity,
  ScreenSecuritySettings,
  ScreenCaptureEvent,
  isSensitiveScreen,
} from '@services/screenSecurity';

// =============================================================================
// useScreenSecurity Hook
// Provides screen security functionality to components
// =============================================================================

export interface UseScreenSecurityOptions {
  /**
   * Override the default sensitive screen detection
   */
  forceSensitive?: boolean;

  /**
   * Callback when screen capture is detected
   */
  onCaptureDetected?: (event: ScreenCaptureEvent) => void;

  /**
   * Whether to automatically enable secure mode based on screen
   */
  autoEnable?: boolean;
}

export interface UseScreenSecurityReturn {
  /**
   * Whether screen security is currently active
   */
  isSecure: boolean;

  /**
   * Whether screen capture is currently being detected
   */
  isCaptureActive: boolean;

  /**
   * Current screen security settings
   */
  settings: ScreenSecuritySettings | null;

  /**
   * Whether the current screen is considered sensitive
   */
  isSensitiveScreen: boolean;

  /**
   * Enable secure mode manually
   */
  enableSecureMode: () => Promise<void>;

  /**
   * Disable secure mode manually
   */
  disableSecureMode: () => Promise<void>;

  /**
   * Update screen security settings
   */
  updateSettings: (settings: Partial<ScreenSecuritySettings>) => Promise<void>;

  /**
   * Temporarily prevent capture for a duration
   */
  preventCaptureFor: (durationMs: number) => Promise<void>;

  /**
   * Reload settings from storage
   */
  refreshSettings: () => Promise<void>;
}

export function useScreenSecurity(
  options: UseScreenSecurityOptions = {}
): UseScreenSecurityReturn {
  const { forceSensitive, onCaptureDetected, autoEnable = true } = options;

  const navigation = useNavigation();
  const route = useRoute();

  const [isSecure, setIsSecure] = useState(false);
  const [isCaptureActive, setIsCaptureActive] = useState(false);
  const [settings, setSettings] = useState<ScreenSecuritySettings | null>(null);

  const onCaptureDetectedRef = useRef(onCaptureDetected);
  onCaptureDetectedRef.current = onCaptureDetected;

  // Determine if current screen is sensitive
  const currentScreenIsSensitive = forceSensitive ?? isSensitiveScreen(route.name);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Set up capture listener
  useEffect(() => {
    const unsubscribe = screenSecurity.addCaptureListener((event) => {
      setIsCaptureActive(event.isCaptured);
      if (event.isCaptured && onCaptureDetectedRef.current) {
        onCaptureDetectedRef.current(event);
      }
    });

    return unsubscribe;
  }, []);

  // Auto-enable secure mode for sensitive screens
  useEffect(() => {
    if (!autoEnable || !settings?.isEnabled) return;

    const enableForSensitiveScreen = async () => {
      if (currentScreenIsSensitive && !screenSecurity.isSecureMode()) {
        await screenSecurity.enableSecureMode();
        setIsSecure(true);
      }
    };

    enableForSensitiveScreen();
  }, [currentScreenIsSensitive, autoEnable, settings?.isEnabled]);

  // Update secure state when it changes
  useEffect(() => {
    setIsSecure(screenSecurity.isSecureMode());
  }, []);

  const loadSettings = useCallback(async () => {
    const loadedSettings = await screenSecurity.getSettings();
    setSettings(loadedSettings);
    setIsSecure(screenSecurity.isSecureMode());
  }, []);

  const enableSecureMode = useCallback(async () => {
    await screenSecurity.enableSecureMode();
    setIsSecure(true);
    await loadSettings();
  }, [loadSettings]);

  const disableSecureMode = useCallback(async () => {
    await screenSecurity.disableSecureMode();
    setIsSecure(false);
    await loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(
    async (newSettings: Partial<ScreenSecuritySettings>) => {
      await screenSecurity.updateSettings(newSettings);
      await loadSettings();
    },
    [loadSettings]
  );

  const preventCaptureFor = useCallback(async (durationMs: number) => {
    await screenSecurity.preventCaptureTemporarily(durationMs);
    setIsSecure(true);
  }, []);

  return {
    isSecure,
    isCaptureActive,
    settings,
    isSensitiveScreen: currentScreenIsSensitive,
    enableSecureMode,
    disableSecureMode,
    updateSettings,
    preventCaptureFor,
    refreshSettings: loadSettings,
  };
}

// =============================================================================
// useScreenCaptureAlert Hook
// Shows an alert/overlay when screen capture is detected
// =============================================================================

export interface UseScreenCaptureAlertOptions {
  /**
   * Message to show when capture is detected
   */
  message?: string;

  /**
   * Whether to show a visual alert
   */
  showAlert?: boolean;

  /**
   * Callback when capture is detected
   */
  onCapture?: () => void;
}

/**
 * React hook `useScreenCaptureAlert`.
 * @param options - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useScreenCaptureAlert(options);
 */
export function useScreenCaptureAlert(options: UseScreenCaptureAlertOptions = {}) {
  const {
    message = 'Screen recording or capture detected. For your privacy, some content may be hidden.',
    showAlert = true,
    onCapture,
  } = options;

  const [showWarning, setShowWarning] = useState(false);

  const { isCaptureActive } = useScreenSecurity({
    onCaptureDetected: (event) => {
      if (event.isCaptured) {
        if (showAlert) {
          setShowWarning(true);
        }
        onCapture?.();
      } else {
        setShowWarning(false);
      }
    },
  });

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  return {
    isCaptureActive,
    showWarning,
    warningMessage: message,
    dismissWarning,
  };
}

// =============================================================================
// usePreventScreenshot Hook
// Simple hook to prevent screenshots on a specific screen
// =============================================================================

/**
 * React hook `usePreventScreenshot`.
 * @param prevent - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = usePreventScreenshot(prevent);
 */
export function usePreventScreenshot(prevent: boolean = true) {
  useEffect(() => {
    if (!prevent) return;

    const enableSecurity = async () => {
      await screenSecurity.enableSecureMode();
    };

    const disableSecurity = async () => {
      // Only disable if no other screens need it
      // For now, we'll leave it enabled as the service manages this
    };

    enableSecurity();

    return () => {
      disableSecurity();
    };
  }, [prevent]);
}

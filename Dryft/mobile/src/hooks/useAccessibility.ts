import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { findNodeHandle, AccessibilityInfo, StyleSheet } from 'react-native';
import {
  accessibilityService,
  AccessibilityState,
  AccessibilityPreferences,
} from '../services/accessibility';

// ============================================================================
// useAccessibilityState - Track system accessibility state
// ============================================================================

/**
 * React hook `useAccessibilityState`.
 * @returns Hook state and actions.
 * @example
 * const value = useAccessibilityState();
 */
export function useAccessibilityState(): AccessibilityState {
  const [state, setState] = useState<AccessibilityState>(
    accessibilityService.getSystemState()
  );

  useEffect(() => {
    const unsubscribe = accessibilityService.addStateListener(setState);
    return unsubscribe;
  }, []);

  return state;
}

// ============================================================================
// useAccessibilityPreferences - Track and update preferences
// ============================================================================

/**
 * React hook `useAccessibilityPreferences`.
 * @returns Hook state and actions.
 * @example
 * const value = useAccessibilityPreferences();
 */
export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    accessibilityService.getPreferences()
  );

  useEffect(() => {
    const unsubscribe = accessibilityService.addPreferenceListener(setPreferences);
    return unsubscribe;
  }, []);

  const updatePreferences = useCallback(
    async (updates: Partial<AccessibilityPreferences>) => {
      await accessibilityService.updatePreferences(updates);
    },
    []
  );

  const resetPreferences = useCallback(async () => {
    await accessibilityService.resetPreferences();
  }, []);

  return {
    preferences,
    updatePreferences,
    resetPreferences,
  };
}

// ============================================================================
// useScreenReader - Screen reader specific hooks
// ============================================================================

/**
 * React hook `useScreenReader`.
 * @returns Hook state and actions.
 * @example
 * const value = useScreenReader();
 */
export function useScreenReader() {
  const state = useAccessibilityState();

  const announce = useCallback((message: string) => {
    accessibilityService.announceForAccessibility(message);
  }, []);

  const focusOn = useCallback((ref: React.RefObject<any>) => {
    if (ref.current) {
      const reactTag = findNodeHandle(ref.current);
      if (reactTag) {
        accessibilityService.setAccessibilityFocus(reactTag);
      }
    }
  }, []);

  return {
    isEnabled: state.isScreenReaderEnabled,
    announce,
    focusOn,
  };
}

// ============================================================================
// useReducedMotion - Check for reduced motion preference
// ============================================================================

/**
 * React hook `useReducedMotion`.
 * @returns Hook state and actions.
 * @example
 * const value = useReducedMotion();
 */
export function useReducedMotion(): boolean {
  const state = useAccessibilityState();
  const { preferences } = useAccessibilityPreferences();

  return state.isReduceMotionEnabled || preferences.reduceMotion;
}

// ============================================================================
// useAnimationConfig - Get animation config respecting reduced motion
// ============================================================================

/**
 * React hook `useAnimationConfig`.
 * @param baseDuration - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useAnimationConfig(baseDuration);
 */
export function useAnimationConfig(baseDuration: number = 300) {
  const reduceMotion = useReducedMotion();

  return useMemo(
    () => ({
      duration: reduceMotion ? 0 : baseDuration,
      useNativeDriver: true,
    }),
    [reduceMotion, baseDuration]
  );
}

// ============================================================================
// useFontScale - Get font scale preference
// ============================================================================

/**
 * React hook `useFontScale`.
 * @returns Hook state and actions.
 * @example
 * const value = useFontScale();
 */
export function useFontScale(): number {
  const { preferences } = useAccessibilityPreferences();
  return preferences.fontScale;
}

// ============================================================================
// useScaledSize - Scale a size based on font scale
// ============================================================================

/**
 * React hook `useScaledSize`.
 * @param baseSize - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useScaledSize(baseSize);
 */
export function useScaledSize(baseSize: number): number {
  const fontScale = useFontScale();
  return Math.round(baseSize * fontScale);
}

// ============================================================================
// useHaptics - Haptic feedback with preference check
// ============================================================================

/**
 * React hook `useHaptics`.
 * @returns Hook state and actions.
 * @example
 * const value = useHaptics();
 */
export function useHaptics() {
  const { preferences } = useAccessibilityPreferences();

  const trigger = useCallback(
    async (
      type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'
    ) => {
      await accessibilityService.triggerHaptic(type);
    },
    []
  );

  return {
    isEnabled: preferences.hapticFeedback,
    trigger,
    light: () => trigger('light'),
    medium: () => trigger('medium'),
    heavy: () => trigger('heavy'),
    success: () => trigger('success'),
    warning: () => trigger('warning'),
    error: () => trigger('error'),
    selection: () => trigger('selection'),
  };
}

// ============================================================================
// useAccessibilityFocus - Manage focus for screen readers
// ============================================================================

/**
 * React hook `useAccessibilityFocus`.
 * @returns Hook state and actions.
 * @example
 * const value = useAccessibilityFocus();
 */
export function useAccessibilityFocus() {
  const focusRef = useRef<any>(null);
  const { isEnabled } = useScreenReader();

  const setFocus = useCallback(() => {
    if (isEnabled && focusRef.current) {
      const reactTag = findNodeHandle(focusRef.current);
      if (reactTag) {
        AccessibilityInfo.setAccessibilityFocus(reactTag);
      }
    }
  }, [isEnabled]);

  // Auto-focus when screen reader becomes active
  useEffect(() => {
    if (isEnabled) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(setFocus, 100);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, setFocus]);

  return {
    focusRef,
    setFocus,
    isScreenReaderEnabled: isEnabled,
  };
}

// ============================================================================
// useAccessibleTouchTarget - Ensure minimum touch target size
// ============================================================================

/**
 * React hook `useAccessibleTouchTarget`.
 * @returns Hook state and actions.
 * @example
 * const value = useAccessibleTouchTarget();
 */
export function useAccessibleTouchTarget() {
  const { preferences } = useAccessibilityPreferences();

  const minSize = useMemo(() => {
    return accessibilityService.getMinTouchTarget();
  }, [preferences.largerTouchTargets]);

  const getStyle = useCallback(
    (width?: number, height?: number) => {
      return {
        minWidth: Math.max(width || 0, minSize),
        minHeight: Math.max(height || 0, minSize),
      };
    },
    [minSize]
  );

  return {
    minSize,
    getStyle,
  };
}

// ============================================================================
// useAccessibilityLabel - Generate accessibility labels
// ============================================================================

/**
 * React hook `useAccessibilityLabel`.
 * @returns Hook state and actions.
 * @example
 * const value = useAccessibilityLabel();
 */
export function useAccessibilityLabel() {
  const { isEnabled } = useScreenReader();
  const { preferences } = useAccessibilityPreferences();

  const createLabel = useCallback(
    (
      primary: string,
      options?: {
        hint?: string;
        value?: string;
        state?: string;
      }
    ) => {
      const parts = [primary];

      if (options?.value) {
        parts.push(options.value);
      }

      if (options?.state) {
        parts.push(options.state);
      }

      return {
        accessible: true,
        accessibilityLabel: parts.join(', '),
        accessibilityHint: preferences.screenReaderHints ? options?.hint : undefined,
      };
    },
    [preferences.screenReaderHints]
  );

  const createButtonLabel = useCallback(
    (label: string, hint?: string) => ({
      accessible: true,
      accessibilityRole: 'button' as const,
      accessibilityLabel: label,
      accessibilityHint: preferences.screenReaderHints ? hint : undefined,
    }),
    [preferences.screenReaderHints]
  );

  const createImageLabel = useCallback(
    (description: string) => ({
      accessible: true,
      accessibilityRole: 'image' as const,
      accessibilityLabel: description,
    }),
    []
  );

  const createLinkLabel = useCallback(
    (label: string, hint?: string) => ({
      accessible: true,
      accessibilityRole: 'link' as const,
      accessibilityLabel: label,
      accessibilityHint: preferences.screenReaderHints ? hint : undefined,
    }),
    [preferences.screenReaderHints]
  );

  return {
    isScreenReaderEnabled: isEnabled,
    createLabel,
    createButtonLabel,
    createImageLabel,
    createLinkLabel,
  };
}

// ============================================================================
// useHighContrast - Check for high contrast mode
// ============================================================================

/**
 * React hook `useHighContrast`.
 * @returns Hook state and actions.
 * @example
 * const value = useHighContrast();
 */
export function useHighContrast(): boolean {
  const { preferences } = useAccessibilityPreferences();
  return preferences.highContrast;
}

// ============================================================================
// useAccessibleColors - Get accessible color variants
// ============================================================================

/**
 * React hook `useAccessibleColors`.
 * @returns Hook state and actions.
 * @example
 * const value = useAccessibleColors();
 */
export function useAccessibleColors() {
  const highContrast = useHighContrast();
  const { preferences } = useAccessibilityPreferences();

  const getColor = useCallback(
    (normalColor: string, highContrastColor?: string) => {
      if (highContrast && highContrastColor) {
        return highContrastColor;
      }
      return accessibilityService.adjustColorForColorBlindness(normalColor);
    },
    [highContrast, preferences.colorBlindMode]
  );

  const getContrastText = useCallback((backgroundColor: string) => {
    return accessibilityService.getContrastColor(backgroundColor);
  }, []);

  return {
    highContrast,
    colorBlindMode: preferences.colorBlindMode,
    getColor,
    getContrastText,
  };
}

// ============================================================================
// useVRAccessibility - VR-specific accessibility settings
// ============================================================================

/**
 * React hook `useVRAccessibility`.
 * @returns Hook state and actions.
 * @example
 * const value = useVRAccessibility();
 */
export function useVRAccessibility() {
  const { preferences, updatePreferences } = useAccessibilityPreferences();

  return {
    comfortMode: preferences.vrComfortMode,
    subtitles: preferences.vrSubtitles,
    audioDescriptions: preferences.vrAudioDescriptions,
    setComfortMode: (enabled: boolean) =>
      updatePreferences({ vrComfortMode: enabled }),
    setSubtitles: (enabled: boolean) =>
      updatePreferences({ vrSubtitles: enabled }),
    setAudioDescriptions: (enabled: boolean) =>
      updatePreferences({ vrAudioDescriptions: enabled }),
  };
}

// ============================================================================
// useAccessibilityAnnouncement - Announce state changes
// ============================================================================

/**
 * React hook `useAccessibilityAnnouncement`.
 * @returns Hook state and actions.
 * @example
 * const value = useAccessibilityAnnouncement();
 */
export function useAccessibilityAnnouncement() {
  const { announce, isEnabled } = useScreenReader();
  const lastAnnouncementRef = useRef<string>('');

  const announceChange = useCallback(
    (message: string, options?: { force?: boolean; delay?: number }) => {
      if (!isEnabled) return;

      // Avoid duplicate announcements
      if (!options?.force && message === lastAnnouncementRef.current) {
        return;
      }

      lastAnnouncementRef.current = message;

      if (options?.delay) {
        setTimeout(() => announce(message), options.delay);
      } else {
        announce(message);
      }
    },
    [isEnabled, announce]
  );

  const announceLoading = useCallback(
    (itemName?: string) => {
      announceChange(itemName ? `Loading ${itemName}` : 'Loading');
    },
    [announceChange]
  );

  const announceLoaded = useCallback(
    (itemName?: string) => {
      announceChange(itemName ? `${itemName} loaded` : 'Content loaded');
    },
    [announceChange]
  );

  const announceError = useCallback(
    (message: string) => {
      announceChange(`Error: ${message}`);
    },
    [announceChange]
  );

  const announceSuccess = useCallback(
    (message: string) => {
      announceChange(message);
    },
    [announceChange]
  );

  return {
    announce: announceChange,
    announceLoading,
    announceLoaded,
    announceError,
    announceSuccess,
  };
}

export default {
  useAccessibilityState,
  useAccessibilityPreferences,
  useScreenReader,
  useReducedMotion,
  useAnimationConfig,
  useFontScale,
  useScaledSize,
  useHaptics,
  useAccessibilityFocus,
  useAccessibleTouchTarget,
  useAccessibilityLabel,
  useHighContrast,
  useAccessibleColors,
  useVRAccessibility,
  useAccessibilityAnnouncement,
};

import { AccessibilityInfo, Platform, PixelRatio, Dimensions } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_THEME_COLORS } from '../../theme/ThemeProvider';

// Accessibility settings storage key
const A11Y_SETTINGS_KEY = 'dryft_accessibility_settings';

// Accessibility settings interface
export interface AccessibilitySettings {
  reduceMotion: boolean;
  screenReaderEnabled: boolean;
  boldTextEnabled: boolean;
  grayscaleEnabled: boolean;
  invertColorsEnabled: boolean;
  reduceTransparencyEnabled: boolean;
  fontScale: number;
  highContrast: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  hapticFeedback: boolean;
  audioDescriptions: boolean;
  largeButtons: boolean;
  extendedTouchTargets: boolean;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  reduceMotion: false,
  screenReaderEnabled: false,
  boldTextEnabled: false,
  grayscaleEnabled: false,
  invertColorsEnabled: false,
  reduceTransparencyEnabled: false,
  fontScale: 1,
  highContrast: false,
  colorBlindMode: 'none',
  hapticFeedback: true,
  audioDescriptions: false,
  largeButtons: false,
  extendedTouchTargets: false,
};

// Hook to detect system accessibility settings
export function useSystemAccessibility() {
  const [settings, setSettings] = useState<Partial<AccessibilitySettings>>({});

  useEffect(() => {
    const checkSettings = async () => {
      const [
        reduceMotion,
        screenReader,
        boldText,
        grayscale,
        invertColors,
        reduceTransparency,
      ] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled(),
        AccessibilityInfo.isScreenReaderEnabled(),
        Platform.OS === 'ios' ? AccessibilityInfo.isBoldTextEnabled() : Promise.resolve(false),
        Platform.OS === 'ios' ? AccessibilityInfo.isGrayscaleEnabled() : Promise.resolve(false),
        Platform.OS === 'ios' ? AccessibilityInfo.isInvertColorsEnabled() : Promise.resolve(false),
        Platform.OS === 'ios' ? AccessibilityInfo.isReduceTransparencyEnabled() : Promise.resolve(false),
      ]);

      setSettings({
        reduceMotion,
        screenReaderEnabled: screenReader,
        boldTextEnabled: boldText,
        grayscaleEnabled: grayscale,
        invertColorsEnabled: invertColors,
        reduceTransparencyEnabled: reduceTransparency,
        fontScale: PixelRatio.getFontScale(),
      });
    };

    checkSettings();

    // Listen for changes
    const reduceMotionListener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setSettings((s) => ({ ...s, reduceMotion: enabled }))
    );

    const screenReaderListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled) => setSettings((s) => ({ ...s, screenReaderEnabled: enabled }))
    );

    return () => {
      reduceMotionListener.remove();
      screenReaderListener.remove();
    };
  }, []);

  return settings;
}

// Hook for user accessibility preferences
export function useAccessibilitySettings() {
  const systemSettings = useSystemAccessibility();
  const [userSettings, setUserSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem(A11Y_SETTINGS_KEY);
        if (saved) {
          setUserSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        }
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      }
      setIsLoaded(true);
    };
    loadSettings();
  }, []);

  // Merge system and user settings
  const mergedSettings: AccessibilitySettings = {
    ...userSettings,
    reduceMotion: systemSettings.reduceMotion || userSettings.reduceMotion,
    screenReaderEnabled: systemSettings.screenReaderEnabled || false,
    boldTextEnabled: systemSettings.boldTextEnabled || userSettings.boldTextEnabled,
    fontScale: Math.max(systemSettings.fontScale || 1, userSettings.fontScale),
  };

  // Update a setting
  const updateSetting = useCallback(
    async <K extends keyof AccessibilitySettings>(
      key: K,
      value: AccessibilitySettings[K]
    ) => {
      const newSettings = { ...userSettings, [key]: value };
      setUserSettings(newSettings);
      try {
        await AsyncStorage.setItem(A11Y_SETTINGS_KEY, JSON.stringify(newSettings));
      } catch (error) {
        console.error('Failed to save accessibility settings:', error);
      }
    },
    [userSettings]
  );

  // Reset to defaults
  const resetSettings = useCallback(async () => {
    setUserSettings(DEFAULT_SETTINGS);
    try {
      await AsyncStorage.removeItem(A11Y_SETTINGS_KEY);
    } catch (error) {
      console.error('Failed to reset accessibility settings:', error);
    }
  }, []);

  return {
    settings: mergedSettings,
    updateSetting,
    resetSettings,
    isLoaded,
  };
}

// Announce to screen reader
export function announceForAccessibility(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

// Check if screen reader is enabled
export async function isScreenReaderEnabled(): Promise<boolean> {
  return AccessibilityInfo.isScreenReaderEnabled();
}

// Focus on element (for screen readers)
export function setAccessibilityFocus(ref: React.RefObject<any>) {
  if (ref.current) {
    AccessibilityInfo.setAccessibilityFocus(ref.current);
  }
}

// Get scaled font size
export function getScaledFontSize(baseSize: number, scale: number = 1): number {
  const fontScale = PixelRatio.getFontScale();
  return Math.round(baseSize * fontScale * scale);
}

// Get minimum touch target size (44pt recommended)
export function getMinTouchTarget(extended: boolean = false): number {
  const base = 44;
  return extended ? base * 1.5 : base;
}

// Color utilities for color blindness
export const colorBlindFilters = {
  none: (color: string) => color,

  // Protanopia (red-blind)
  protanopia: (color: string) => {
    // Simplified filter - in production use proper color matrix
    return color;
  },

  // Deuteranopia (green-blind)
  deuteranopia: (color: string) => {
    return color;
  },

  // Tritanopia (blue-blind)
  tritanopia: (color: string) => {
    return color;
  },
};

// High contrast color palette
export const highContrastColors = {
  background: 'black',
  surface: 'dimgray',
  primary: 'white',
  secondary: 'yellow',
  error: 'red',
  success: 'lime',
  text: 'white',
  textSecondary: 'lightgray',
  border: 'white',
  accent: 'cyan',
};

// Standard color palette
export const standardColors = {
  background: DARK_THEME_COLORS.background,
  surface: DARK_THEME_COLORS.surface,
  primary: DARK_THEME_COLORS.primary,
  secondary: DARK_THEME_COLORS.textSecondary,
  error: DARK_THEME_COLORS.safetyWarning,
  success: DARK_THEME_COLORS.success,
  text: DARK_THEME_COLORS.text,
  textSecondary: DARK_THEME_COLORS.textSecondary,
  border: DARK_THEME_COLORS.backgroundSecondary,
  accent: DARK_THEME_COLORS.primary,
};

// Get colors based on accessibility settings
export function getAccessibleColors(highContrast: boolean) {
  return highContrast ? highContrastColors : standardColors;
}

// Animation duration based on reduce motion preference
export function getAnimationDuration(
  baseDuration: number,
  reduceMotion: boolean
): number {
  return reduceMotion ? 0 : baseDuration;
}

// Accessibility labels for common actions
export const accessibilityLabels = {
  // Navigation
  goBack: 'Go back',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  openSettings: 'Open settings',

  // Matching
  likeProfile: 'Like this profile',
  passProfile: 'Pass on this profile',
  superLike: 'Super like this profile',
  viewProfile: 'View full profile',
  nextPhoto: 'View next photo',
  previousPhoto: 'View previous photo',

  // Chat
  sendMessage: 'Send message',
  attachPhoto: 'Attach photo',
  startCall: 'Start call',
  endCall: 'End call',

  // Safety
  panicButton: 'Emergency exit - leave immediately',
  blockUser: 'Block this user',
  reportUser: 'Report this user',
  unblockUser: 'Unblock this user',

  // VR
  enterVR: 'Enter virtual reality mode',
  exitVR: 'Exit virtual reality mode',
  inviteToVR: 'Invite to virtual reality',
};

// Role descriptions for custom components
export const accessibilityRoles = {
  card: 'Profile card',
  swipeArea: 'Swipeable area',
  chatBubble: 'Message',
  matchNotification: 'Match notification',
  safetyControl: 'Safety control',
};

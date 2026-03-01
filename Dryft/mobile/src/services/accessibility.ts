import { AccessibilityInfo, Platform, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export interface AccessibilityState {
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
  isReduceTransparencyEnabled: boolean;
  isBoldTextEnabled: boolean;
  isGrayscaleEnabled: boolean;
  isInvertColorsEnabled: boolean;
  prefersCrossFadeTransitions: boolean;
}

export interface AccessibilityPreferences {
  // Text & Display
  fontScale: number; // 0.85 - 1.5
  highContrast: boolean;
  largerTouchTargets: boolean;

  // Motion
  reduceMotion: boolean;
  autoPlayVideos: boolean;

  // Audio & Haptics
  screenReaderHints: boolean;
  hapticFeedback: boolean;
  soundEffects: boolean;

  // Navigation
  simplifiedNavigation: boolean;
  showLabelsAlways: boolean;

  // Colors
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

  // VR Specific
  vrComfortMode: boolean;
  vrSubtitles: boolean;
  vrAudioDescriptions: boolean;
}

type AccessibilityListener = (state: AccessibilityState) => void;
type PreferenceListener = (prefs: AccessibilityPreferences) => void;

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'dryft_accessibility_preferences';

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  fontScale: 1.0,
  highContrast: false,
  largerTouchTargets: false,
  reduceMotion: false,
  autoPlayVideos: true,
  screenReaderHints: true,
  hapticFeedback: true,
  soundEffects: true,
  simplifiedNavigation: false,
  showLabelsAlways: false,
  colorBlindMode: 'none',
  vrComfortMode: false,
  vrSubtitles: false,
  vrAudioDescriptions: false,
};

// ============================================================================
// Accessibility Service
// ============================================================================

class AccessibilityService {
  private static instance: AccessibilityService;
  private systemState: AccessibilityState = {
    isScreenReaderEnabled: false,
    isReduceMotionEnabled: false,
    isReduceTransparencyEnabled: false,
    isBoldTextEnabled: false,
    isGrayscaleEnabled: false,
    isInvertColorsEnabled: false,
    prefersCrossFadeTransitions: false,
  };
  private preferences: AccessibilityPreferences = DEFAULT_PREFERENCES;
  private stateListeners: Set<AccessibilityListener> = new Set();
  private prefListeners: Set<PreferenceListener> = new Set();
  private subscriptions: Array<{ remove: () => void }> = [];
  private initialized = false;

  private constructor() {}

  static getInstance(): AccessibilityService {
    if (!AccessibilityService.instance) {
      AccessibilityService.instance = new AccessibilityService();
    }
    return AccessibilityService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load saved preferences
    await this.loadPreferences();

    // Get initial system state
    await this.refreshSystemState();

    // Subscribe to system accessibility changes
    this.subscriptions.push(
      AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        this.handleScreenReaderChange
      )
    );

    this.subscriptions.push(
      AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        this.handleReduceMotionChange
      )
    );

    if (Platform.OS === 'ios') {
      this.subscriptions.push(
        AccessibilityInfo.addEventListener(
          'reduceTransparencyChanged',
          this.handleReduceTransparencyChange
        )
      );

      this.subscriptions.push(
        AccessibilityInfo.addEventListener(
          'boldTextChanged',
          this.handleBoldTextChange
        )
      );

      this.subscriptions.push(
        AccessibilityInfo.addEventListener(
          'grayscaleChanged',
          this.handleGrayscaleChange
        )
      );

      this.subscriptions.push(
        AccessibilityInfo.addEventListener(
          'invertColorsChanged',
          this.handleInvertColorsChange
        )
      );
    }

    this.initialized = true;
    console.log('[Accessibility] Initialized', this.systemState);
  }

  cleanup(): void {
    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
    this.stateListeners.clear();
    this.prefListeners.clear();
  }

  // ==========================================================================
  // System State
  // ==========================================================================

  private async refreshSystemState(): Promise<void> {
    const [
      screenReader,
      reduceMotion,
      reduceTransparency,
      boldText,
      grayscale,
      invertColors,
    ] = await Promise.all([
      AccessibilityInfo.isScreenReaderEnabled(),
      AccessibilityInfo.isReduceMotionEnabled(),
      Platform.OS === 'ios'
        ? AccessibilityInfo.isReduceTransparencyEnabled()
        : Promise.resolve(false),
      Platform.OS === 'ios'
        ? AccessibilityInfo.isBoldTextEnabled()
        : Promise.resolve(false),
      Platform.OS === 'ios'
        ? AccessibilityInfo.isGrayscaleEnabled()
        : Promise.resolve(false),
      Platform.OS === 'ios'
        ? AccessibilityInfo.isInvertColorsEnabled()
        : Promise.resolve(false),
    ]);

    this.systemState = {
      isScreenReaderEnabled: screenReader,
      isReduceMotionEnabled: reduceMotion,
      isReduceTransparencyEnabled: reduceTransparency,
      isBoldTextEnabled: boldText,
      isGrayscaleEnabled: grayscale,
      isInvertColorsEnabled: invertColors,
      prefersCrossFadeTransitions: reduceMotion,
    };

    // Auto-sync some preferences with system settings
    if (reduceMotion && !this.preferences.reduceMotion) {
      this.preferences.reduceMotion = true;
      await this.savePreferences();
    }
  }

  private handleScreenReaderChange = (isEnabled: boolean): void => {
    this.systemState.isScreenReaderEnabled = isEnabled;
    this.notifyStateListeners();

    trackEvent('accessibility_changed', {
      setting: 'screen_reader',
      enabled: isEnabled,
    });
  };

  private handleReduceMotionChange = (isEnabled: boolean): void => {
    this.systemState.isReduceMotionEnabled = isEnabled;
    this.systemState.prefersCrossFadeTransitions = isEnabled;
    this.notifyStateListeners();

    // Auto-sync preference
    if (isEnabled !== this.preferences.reduceMotion) {
      this.preferences.reduceMotion = isEnabled;
      this.savePreferences();
      this.notifyPrefListeners();
    }
  };

  private handleReduceTransparencyChange = (isEnabled: boolean): void => {
    this.systemState.isReduceTransparencyEnabled = isEnabled;
    this.notifyStateListeners();
  };

  private handleBoldTextChange = (isEnabled: boolean): void => {
    this.systemState.isBoldTextEnabled = isEnabled;
    this.notifyStateListeners();
  };

  private handleGrayscaleChange = (isEnabled: boolean): void => {
    this.systemState.isGrayscaleEnabled = isEnabled;
    this.notifyStateListeners();
  };

  private handleInvertColorsChange = (isEnabled: boolean): void => {
    this.systemState.isInvertColorsEnabled = isEnabled;
    this.notifyStateListeners();
  };

  // ==========================================================================
  // Preferences
  // ==========================================================================

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[Accessibility] Failed to load preferences:', error);
    }
  }

  private async savePreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('[Accessibility] Failed to save preferences:', error);
    }
  }

  async updatePreferences(
    updates: Partial<AccessibilityPreferences>
  ): Promise<void> {
    const oldPrefs = { ...this.preferences };
    this.preferences = { ...this.preferences, ...updates };
    await this.savePreferences();
    this.notifyPrefListeners();

    // Track changes
    Object.entries(updates).forEach(([key, value]) => {
      if (oldPrefs[key as keyof AccessibilityPreferences] !== value) {
        trackEvent('accessibility_preference_changed', {
          setting: key,
          value: String(value),
        });
      }
    });
  }

  async resetPreferences(): Promise<void> {
    this.preferences = { ...DEFAULT_PREFERENCES };
    await this.savePreferences();
    this.notifyPrefListeners();

    trackEvent('accessibility_preferences_reset', {});
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getSystemState(): AccessibilityState {
    return { ...this.systemState };
  }

  getPreferences(): AccessibilityPreferences {
    return { ...this.preferences };
  }

  isScreenReaderActive(): boolean {
    return this.systemState.isScreenReaderEnabled;
  }

  shouldReduceMotion(): boolean {
    return this.systemState.isReduceMotionEnabled || this.preferences.reduceMotion;
  }

  getFontScale(): number {
    return this.preferences.fontScale;
  }

  isHighContrastEnabled(): boolean {
    return this.preferences.highContrast;
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  addStateListener(listener: AccessibilityListener): () => void {
    this.stateListeners.add(listener);
    listener(this.systemState);
    return () => this.stateListeners.delete(listener);
  }

  addPreferenceListener(listener: PreferenceListener): () => void {
    this.prefListeners.add(listener);
    listener(this.preferences);
    return () => this.prefListeners.delete(listener);
  }

  private notifyStateListeners(): void {
    this.stateListeners.forEach((listener) => {
      try {
        listener(this.systemState);
      } catch (error) {
        console.error('[Accessibility] State listener error:', error);
      }
    });
  }

  private notifyPrefListeners(): void {
    this.prefListeners.forEach((listener) => {
      try {
        listener(this.preferences);
      } catch (error) {
        console.error('[Accessibility] Preference listener error:', error);
      }
    });
  }

  // ==========================================================================
  // Screen Reader Helpers
  // ==========================================================================

  announceForAccessibility(message: string): void {
    AccessibilityInfo.announceForAccessibility(message);
  }

  setAccessibilityFocus(reactTag: number): void {
    AccessibilityInfo.setAccessibilityFocus(reactTag);
  }

  // ==========================================================================
  // Haptic Feedback
  // ==========================================================================

  async triggerHaptic(
    type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'
  ): Promise<void> {
    if (!this.preferences.hapticFeedback) return;

    try {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          await Haptics.selectionAsync();
          break;
      }
    } catch (error) {
      // Haptics may not be available on all devices
    }
  }

  // ==========================================================================
  // Animation Helpers
  // ==========================================================================

  getAnimationDuration(baseDuration: number): number {
    if (this.shouldReduceMotion()) {
      return 0;
    }
    return baseDuration;
  }

  getAnimationConfig(baseConfig: any): any {
    if (this.shouldReduceMotion()) {
      return {
        ...baseConfig,
        duration: 0,
        useNativeDriver: true,
      };
    }
    return baseConfig;
  }

  // ==========================================================================
  // Touch Target Helpers
  // ==========================================================================

  getMinTouchTarget(): number {
    // Apple recommends 44pt, Android recommends 48dp
    const baseSize = Platform.OS === 'ios' ? 44 : 48;
    return this.preferences.largerTouchTargets ? baseSize * 1.25 : baseSize;
  }

  // ==========================================================================
  // Color Helpers
  // ==========================================================================

  adjustColorForColorBlindness(color: string): string {
    if (this.preferences.colorBlindMode === 'none') {
      return color;
    }

    // This is a simplified version - real implementation would use
    // proper color transformation matrices
    // For now, return the original color
    return color;
  }

  getContrastColor(backgroundColor: string): string {
    // Simple luminance calculation
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? 'black' : 'white';
  }
}

export const accessibilityService = AccessibilityService.getInstance();
export default accessibilityService;

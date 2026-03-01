import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Settings Types
export interface NotificationSettings {
  enabled: boolean;
  matches: boolean;
  messages: boolean;
  likes: boolean;
  vrInvites: boolean;
  marketing: boolean;
  sound: boolean;
  vibration: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string;
}

export interface PrivacySettings {
  showOnlineStatus: boolean;
  showLastActive: boolean;
  showDistance: boolean;
  showAge: boolean;
  readReceipts: boolean;
  allowScreenshots: boolean;
  discoverableByNearby: boolean;
  shareActivityWithMatches: boolean;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  reduceMotion: boolean;
  highContrast: boolean;
}

export interface VRSettings {
  comfortMode: 'comfortable' | 'moderate' | 'intense';
  movementType: 'teleport' | 'smooth' | 'hybrid';
  turnType: 'snap' | 'smooth';
  snapTurnAngle: 30 | 45 | 60 | 90;
  smoothTurnSpeed: number;
  handedness: 'right' | 'left';
  showVignette: boolean;
  heightCalibration: number;
  voiceChatVolume: number;
  musicVolume: number;
  sfxVolume: number;
  spatialAudio: boolean;
}

export interface HapticSettings {
  enabled: boolean;
  deviceId: string | null;
  deviceName: string | null;
  intensity: number; // 0-100
  allowRemoteControl: boolean;
  requireConsent: boolean;
  autoConnect: boolean;
}

export interface MatchingPreferences {
  interestedIn: 'men' | 'women' | 'everyone';
  ageRangeMin: number;
  ageRangeMax: number;
  maxDistance: number;
  distanceUnit: 'miles' | 'kilometers';
  showVerifiedOnly: boolean;
  vrUsersOnly: boolean;
  relationshipTypes: ('dating' | 'casual' | 'friends' | 'open')[];
}

export interface SafetySettings {
  panicButtonEnabled: boolean;
  panicButtonVibration: boolean;
  autoBlockOnReport: boolean;
  hideBlockedContent: boolean;
  contentFilterLevel: 'strict' | 'moderate' | 'relaxed';
  requireConsentForHaptics: boolean;
  safeWordEnabled: boolean;
  safeWord: string;
}

export interface AllSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  appearance: AppearanceSettings;
  vr: VRSettings;
  haptic: HapticSettings;
  matching: MatchingPreferences;
  safety: SafetySettings;
}

interface SettingsState extends AllSettings {
  // Metadata
  lastSyncedAt: number | null;
  isDirty: boolean;
  version: number;

  // Actions - Notifications
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;

  // Actions - Privacy
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;

  // Actions - Appearance
  updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;

  // Actions - VR
  updateVRSettings: (settings: Partial<VRSettings>) => void;

  // Actions - Haptic
  updateHapticSettings: (settings: Partial<HapticSettings>) => void;

  // Actions - Matching
  updateMatchingPreferences: (settings: Partial<MatchingPreferences>) => void;

  // Actions - Safety
  updateSafetySettings: (settings: Partial<SafetySettings>) => void;

  // Sync Actions
  markSynced: () => void;
  setAllSettings: (settings: AllSettings) => void;
  resetToDefaults: () => void;
  getChangedSettings: () => Partial<AllSettings>;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  matches: true,
  messages: true,
  likes: true,
  vrInvites: true,
  marketing: false,
  sound: true,
  vibration: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showOnlineStatus: true,
  showLastActive: true,
  showDistance: true,
  showAge: true,
  readReceipts: true,
  allowScreenshots: false,
  discoverableByNearby: true,
  shareActivityWithMatches: false,
};

const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'dark',
  fontSize: 'medium',
  reduceMotion: false,
  highContrast: false,
};

const DEFAULT_VR_SETTINGS: VRSettings = {
  comfortMode: 'comfortable',
  movementType: 'teleport',
  turnType: 'snap',
  snapTurnAngle: 45,
  smoothTurnSpeed: 60,
  handedness: 'right',
  showVignette: true,
  heightCalibration: 0,
  voiceChatVolume: 80,
  musicVolume: 50,
  sfxVolume: 70,
  spatialAudio: true,
};

const DEFAULT_HAPTIC_SETTINGS: HapticSettings = {
  enabled: false,
  deviceId: null,
  deviceName: null,
  intensity: 50,
  allowRemoteControl: false,
  requireConsent: true,
  autoConnect: false,
};

const DEFAULT_MATCHING_PREFERENCES: MatchingPreferences = {
  interestedIn: 'everyone',
  ageRangeMin: 18,
  ageRangeMax: 50,
  maxDistance: 50,
  distanceUnit: 'miles',
  showVerifiedOnly: false,
  vrUsersOnly: false,
  relationshipTypes: ['dating'],
};

const DEFAULT_SAFETY_SETTINGS: SafetySettings = {
  panicButtonEnabled: true,
  panicButtonVibration: true,
  autoBlockOnReport: true,
  hideBlockedContent: true,
  contentFilterLevel: 'moderate',
  requireConsentForHaptics: true,
  safeWordEnabled: false,
  safeWord: '',
};

const SETTINGS_VERSION = 1;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: DEFAULT_NOTIFICATION_SETTINGS,
      privacy: DEFAULT_PRIVACY_SETTINGS,
      appearance: DEFAULT_APPEARANCE_SETTINGS,
      vr: DEFAULT_VR_SETTINGS,
      haptic: DEFAULT_HAPTIC_SETTINGS,
      matching: DEFAULT_MATCHING_PREFERENCES,
      safety: DEFAULT_SAFETY_SETTINGS,
      lastSyncedAt: null,
      isDirty: false,
      version: SETTINGS_VERSION,

      // Notification settings
      updateNotificationSettings: (settings) => set((state) => ({
        notifications: { ...state.notifications, ...settings },
        isDirty: true,
      })),

      // Privacy settings
      updatePrivacySettings: (settings) => set((state) => ({
        privacy: { ...state.privacy, ...settings },
        isDirty: true,
      })),

      // Appearance settings
      updateAppearanceSettings: (settings) => set((state) => ({
        appearance: { ...state.appearance, ...settings },
        isDirty: true,
      })),

      // VR settings
      updateVRSettings: (settings) => set((state) => ({
        vr: { ...state.vr, ...settings },
        isDirty: true,
      })),

      // Haptic settings
      updateHapticSettings: (settings) => set((state) => ({
        haptic: { ...state.haptic, ...settings },
        isDirty: true,
      })),

      // Matching preferences
      updateMatchingPreferences: (settings) => set((state) => ({
        matching: { ...state.matching, ...settings },
        isDirty: true,
      })),

      // Safety settings
      updateSafetySettings: (settings) => set((state) => ({
        safety: { ...state.safety, ...settings },
        isDirty: true,
      })),

      // Sync actions
      markSynced: () => set({
        lastSyncedAt: Date.now(),
        isDirty: false,
      }),

      setAllSettings: (settings) => set({
        notifications: settings.notifications,
        privacy: settings.privacy,
        appearance: settings.appearance,
        vr: settings.vr,
        haptic: settings.haptic,
        matching: settings.matching,
        safety: settings.safety,
        lastSyncedAt: Date.now(),
        isDirty: false,
      }),

      resetToDefaults: () => set({
        notifications: DEFAULT_NOTIFICATION_SETTINGS,
        privacy: DEFAULT_PRIVACY_SETTINGS,
        appearance: DEFAULT_APPEARANCE_SETTINGS,
        vr: DEFAULT_VR_SETTINGS,
        haptic: DEFAULT_HAPTIC_SETTINGS,
        matching: DEFAULT_MATCHING_PREFERENCES,
        safety: DEFAULT_SAFETY_SETTINGS,
        isDirty: true,
      }),

      getChangedSettings: () => {
        const state = get();
        return {
          notifications: state.notifications,
          privacy: state.privacy,
          appearance: state.appearance,
          vr: state.vr,
          haptic: state.haptic,
          matching: state.matching,
          safety: state.safety,
        };
      },
    }),
    {
      name: 'dryft-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: SETTINGS_VERSION,
      migrate: (persistedState: any, version: number) => {
        if (version < SETTINGS_VERSION) {
          // Handle migrations here
          return {
            ...persistedState,
            version: SETTINGS_VERSION,
          };
        }
        return persistedState as SettingsState;
      },
    }
  )
);

// Selectors
export const selectNotificationSettings = (state: SettingsState) => state.notifications;
export const selectPrivacySettings = (state: SettingsState) => state.privacy;
export const selectAppearanceSettings = (state: SettingsState) => state.appearance;
export const selectVRSettings = (state: SettingsState) => state.vr;
export const selectHapticSettings = (state: SettingsState) => state.haptic;
export const selectMatchingPreferences = (state: SettingsState) => state.matching;
export const selectSafetySettings = (state: SettingsState) => state.safety;

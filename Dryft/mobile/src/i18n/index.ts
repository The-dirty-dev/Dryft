import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import ko from './locales/ko.json';
import zhCN from './locales/zh-CN.json';

export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  he: { name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  fa: { name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  ur: { name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

const LANGUAGE_STORAGE_KEY = 'dryft_language';

// Fallback chain for locale variants (e.g., zh-CN -> zh -> en).
export const FALLBACK_CHAIN = {
  'zh-CN': ['zh', 'en'],
  default: ['en'],
} as const;

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  ja: { translation: ja },
  pt: { translation: pt },
  it: { translation: it },
  ko: { translation: ko },
  'zh-CN': { translation: zhCN },
};

// Language detector for AsyncStorage
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      // Check stored preference
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage && storedLanguage in SUPPORTED_LANGUAGES) {
        callback(storedLanguage);
        return;
      }

      // Fall back to device locale
      const deviceLocale = Localization.locale;
      if (deviceLocale in SUPPORTED_LANGUAGES) {
        callback(deviceLocale);
        return;
      }

      const deviceLanguage = deviceLocale.split('-')[0];
      if (deviceLanguage in SUPPORTED_LANGUAGES) {
        callback(deviceLanguage);
        return;
      }

      // Default to English
      callback('en');
    } catch (error) {
      console.error('Error detecting language:', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.error('Error caching language:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_CHAIN,
    compatibilityJSON: 'v3',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Helper to change language
export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);

  // Check if RTL state needs to change
  const needsRTL = isRTL(language);
  const currentRTL = I18nManager.isRTL;

  if (needsRTL !== currentRTL) {
    await syncRTLLayout(needsRTL);
  }
}

// Get current language
export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language as SupportedLanguage) || 'en';
}

// Check if language is RTL
// Currently supported RTL languages (for future Arabic/Hebrew support)
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

export function isRTL(language?: SupportedLanguage): boolean {
  return RTL_LANGUAGES.includes(language || getCurrentLanguage());
}

// Check if current layout is RTL
export function isLayoutRTL(): boolean {
  return I18nManager.isRTL;
}

// Sync RTL layout with the current language
// Note: RTL changes require app restart to take full effect
export async function syncRTLLayout(forceRTL?: boolean): Promise<boolean> {
  const shouldBeRTL = forceRTL ?? isRTL();
  const currentRTL = I18nManager.isRTL;

  if (shouldBeRTL === currentRTL) {
    return false; // No change needed
  }

  // Apply RTL setting
  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);

  // RTL changes require restart to take effect
  // In development, we can use expo-updates to reload
  // In production, user needs to restart the app
  if (__DEV__) {
    console.log(`[i18n] RTL changed to ${shouldBeRTL}, reloading app...`);
  }

  return true; // Layout change was applied (restart needed)
}

// Initialize RTL on app start (call this in App.tsx useEffect)
export async function initializeRTL(): Promise<void> {
  const language = getCurrentLanguage();
  const shouldBeRTL = isRTL(language);
  const currentRTL = I18nManager.isRTL;

  if (shouldBeRTL !== currentRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    // Note: Changes take effect on next app launch
  }
}

export default i18n;

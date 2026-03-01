import { I18nManager, Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type SupportedLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'ar'
  | 'hi'
  | 'ru';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  isRTL: boolean;
  dateFormat: string;
  timeFormat: string;
}

export type TranslationResources = {
  [key: string]: string | TranslationResources;
};

export interface PluralRules {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

type LanguageChangeListener = (language: SupportedLanguage) => void;

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'dryft_language';

const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    isRTL: false,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'h:mm A',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    isRTL: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    isRTL: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    isRTL: false,
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    isRTL: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    isRTL: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    isRTL: false,
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm',
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    isRTL: false,
    dateFormat: 'YYYY.MM.DD',
    timeFormat: 'HH:mm',
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    isRTL: false,
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    isRTL: true,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    isRTL: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'h:mm A',
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    isRTL: false,
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm',
  },
};

// Default English translations (other languages would be loaded dynamically)
const DEFAULT_TRANSLATIONS: TranslationResources = {
  en: {
    common: {
      ok: 'OK',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      done: 'Done',
      next: 'Next',
      back: 'Back',
      skip: 'Skip',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      retry: 'Retry',
      close: 'Close',
      search: 'Search',
      settings: 'Settings',
      help: 'Help',
      logout: 'Log Out',
    },
    auth: {
      login: 'Log In',
      signup: 'Sign Up',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      createAccount: 'Create Account',
      alreadyHaveAccount: 'Already have an account?',
      dontHaveAccount: "Don't have an account?",
    },
    profile: {
      myProfile: 'My Profile',
      editProfile: 'Edit Profile',
      photos: 'Photos',
      bio: 'Bio',
      age: 'Age',
      location: 'Location',
      interests: 'Interests',
      verified: 'Verified',
      verifyNow: 'Verify Now',
    },
    discovery: {
      discover: 'Discover',
      noMoreProfiles: 'No more profiles',
      comeBackLater: 'Come back later for more matches!',
      like: 'Like',
      pass: 'Pass',
      superLike: 'Super Like',
      itsAMatch: "It's a Match!",
      youAndName: 'You and {{name}} liked each other',
      sendMessage: 'Send Message',
      keepSwiping: 'Keep Swiping',
    },
    matches: {
      matches: 'Matches',
      messages: 'Messages',
      newMatch: 'New Match',
      noMatches: 'No matches yet',
      startSwiping: 'Start swiping to find your match!',
      unmatch: 'Unmatch',
      report: 'Report',
      block: 'Block',
    },
    chat: {
      typeMessage: 'Type a message...',
      send: 'Send',
      delivered: 'Delivered',
      read: 'Read',
      today: 'Today',
      yesterday: 'Yesterday',
      online: 'Online',
      lastSeen: 'Last seen {{time}}',
      typing: 'typing...',
    },
    vr: {
      vrDate: 'VR Date',
      startVR: 'Start VR Session',
      joinVR: 'Join VR Session',
      inviteToVR: 'Invite to VR Date',
      enterCode: 'Enter invite code',
      sessionEnded: 'Session Ended',
      connecting: 'Connecting...',
    },
    settings: {
      account: 'Account',
      notifications: 'Notifications',
      privacy: 'Privacy',
      language: 'Language',
      appearance: 'Appearance',
      accessibility: 'Accessibility',
      helpSupport: 'Help & Support',
      about: 'About',
      deleteAccount: 'Delete Account',
      pauseAccount: 'Pause Account',
    },
    notifications: {
      newMatch: 'You have a new match!',
      newMessage: 'New message from {{name}}',
      newLike: 'Someone likes you!',
      vrInvite: '{{name}} invited you to a VR date',
    },
    errors: {
      networkError: 'Network error. Please check your connection.',
      somethingWrong: 'Something went wrong. Please try again.',
      sessionExpired: 'Your session has expired. Please log in again.',
      invalidCredentials: 'Invalid email or password.',
    },
    time: {
      justNow: 'Just now',
      minutesAgo: '{{count}} minute ago',
      minutesAgo_plural: '{{count}} minutes ago',
      hoursAgo: '{{count}} hour ago',
      hoursAgo_plural: '{{count}} hours ago',
      daysAgo: '{{count}} day ago',
      daysAgo_plural: '{{count}} days ago',
    },
  },
};

// ============================================================================
// i18n Service
// ============================================================================

class I18nService {
  private static instance: I18nService;
  private currentLanguage: SupportedLanguage = 'en';
  private translations: TranslationResources = DEFAULT_TRANSLATIONS;
  private listeners: Set<LanguageChangeListener> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load saved language preference
    const savedLanguage = await this.loadSavedLanguage();

    if (savedLanguage) {
      this.currentLanguage = savedLanguage;
    } else {
      // Detect device language
      this.currentLanguage = this.detectDeviceLanguage();
    }

    // Load translations for current language
    await this.loadTranslations(this.currentLanguage);

    // Configure RTL if needed
    this.configureRTL();

    this.initialized = true;
    console.log('[i18n] Initialized with language:', this.currentLanguage);
  }

  private async loadSavedLanguage(): Promise<SupportedLanguage | null> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved && this.isSupported(saved)) {
        return saved as SupportedLanguage;
      }
    } catch (error) {
      console.error('[i18n] Failed to load saved language:', error);
    }
    return null;
  }

  private detectDeviceLanguage(): SupportedLanguage {
    // Get device locale
    const deviceLocale = Localization.locale;
    const languageCode = deviceLocale.split('-')[0].toLowerCase();

    // Check if we support this language
    if (this.isSupported(languageCode)) {
      return languageCode as SupportedLanguage;
    }

    // Default to English
    return 'en';
  }

  private async loadTranslations(language: SupportedLanguage): Promise<void> {
    // In a real app, you would load translations from a file or API
    // For now, we just use the default translations
    if (!this.translations[language]) {
      // Would load from: await import(`../locales/${language}.json`)
      console.log(`[i18n] Would load translations for: ${language}`);
    }
  }

  private configureRTL(): void {
    const languageInfo = SUPPORTED_LANGUAGES[this.currentLanguage];
    const isRTL = languageInfo?.isRTL || false;

    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
      // Note: App needs to restart for RTL changes to take effect
    }
  }

  // ==========================================================================
  // Language Management
  // ==========================================================================

  async setLanguage(language: SupportedLanguage): Promise<boolean> {
    if (!this.isSupported(language)) {
      console.warn(`[i18n] Language not supported: ${language}`);
      return false;
    }

    const previousLanguage = this.currentLanguage;
    this.currentLanguage = language;

    // Save preference
    try {
      await AsyncStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.error('[i18n] Failed to save language:', error);
    }

    // Load translations
    await this.loadTranslations(language);

    // Configure RTL
    this.configureRTL();

    // Notify listeners
    this.notifyListeners();

    // Track change
    trackEvent('language_changed', {
      from: previousLanguage,
      to: language,
    });

    return true;
  }

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  getLanguageInfo(language?: SupportedLanguage): LanguageInfo {
    return SUPPORTED_LANGUAGES[language || this.currentLanguage];
  }

  getSupportedLanguages(): LanguageInfo[] {
    return Object.values(SUPPORTED_LANGUAGES);
  }

  isSupported(language: string): boolean {
    return language in SUPPORTED_LANGUAGES;
  }

  isRTL(): boolean {
    return SUPPORTED_LANGUAGES[this.currentLanguage]?.isRTL || false;
  }

  // ==========================================================================
  // Translation
  // ==========================================================================

  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = this.translations[this.currentLanguage];

    // Traverse the translation object
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English
    if (value === undefined) {
      value = this.translations.en;
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }
    }

    // Fallback to key
    if (typeof value !== 'string') {
      console.warn(`[i18n] Missing translation: ${key}`);
      return key;
    }

    // Replace parameters
    if (params) {
      value = this.interpolate(value, params);
    }

    return value;
  }

  private interpolate(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  plural(key: string, count: number, params?: Record<string, string | number>): string {
    const pluralKey = count === 1 ? key : `${key}_plural`;
    return this.t(pluralKey, { ...params, count });
  }

  // ==========================================================================
  // Formatting
  // ==========================================================================

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.currentLanguage, options).format(value);
  }

  formatCurrency(value: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(this.currentLanguage, {
      style: 'currency',
      currency,
    }).format(value);
  }

  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.currentLanguage, options).format(date);
  }

  formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.currentLanguage, {
      hour: 'numeric',
      minute: 'numeric',
      ...options,
    }).format(date);
  }

  formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return this.t('time.justNow');
    }
    if (minutes < 60) {
      return this.plural('time.minutesAgo', minutes);
    }
    if (hours < 24) {
      return this.plural('time.hoursAgo', hours);
    }
    return this.plural('time.daysAgo', days);
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  addListener(listener: LanguageChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentLanguage);
      } catch (error) {
        console.error('[i18n] Listener error:', error);
      }
    });
  }
}

export const i18n = I18nService.getInstance();
export const t = i18n.t.bind(i18n);
export default i18n;

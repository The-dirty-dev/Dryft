import { useState, useEffect, useCallback, useMemo } from 'react';
import { I18nManager, StyleSheet } from 'react-native';
import { i18n, SupportedLanguage, LanguageInfo } from '../services/i18n';

// ============================================================================
// useTranslation - Main translation hook
// ============================================================================

/**
 * React hook `useTranslation`.
 * @param namespace? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useTranslation(namespace?);
 */
export function useTranslation(namespace?: string) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = i18n.addListener(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return i18n.t(fullKey, params);
    },
    [namespace]
  );

  const plural = useCallback(
    (key: string, count: number, params?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return i18n.plural(fullKey, count, params);
    },
    [namespace]
  );

  return {
    t,
    plural,
    language: i18n.getLanguage(),
    isRTL: i18n.isRTL(),
  };
}

// ============================================================================
// useLanguage - Language management hook
// ============================================================================

/**
 * React hook `useLanguage`.
 * @returns Hook state and actions.
 * @example
 * const value = useLanguage();
 */
export function useLanguage() {
  const [language, setLanguageState] = useState<SupportedLanguage>(i18n.getLanguage());

  useEffect(() => {
    const unsubscribe = i18n.addListener((newLanguage) => {
      setLanguageState(newLanguage);
    });
    return unsubscribe;
  }, []);

  const setLanguage = useCallback(async (newLanguage: SupportedLanguage) => {
    const success = await i18n.setLanguage(newLanguage);
    return success;
  }, []);

  const languageInfo = useMemo(() => i18n.getLanguageInfo(language), [language]);

  const supportedLanguages = useMemo(() => i18n.getSupportedLanguages(), []);

  return {
    language,
    languageInfo,
    supportedLanguages,
    setLanguage,
    isRTL: languageInfo.isRTL,
  };
}

// ============================================================================
// useRTL - RTL layout hook
// ============================================================================

/**
 * React hook `useRTL`.
 * @returns Hook state and actions.
 * @example
 * const value = useRTL();
 */
export function useRTL() {
  const { isRTL } = useLanguage();

  const rtlStyle = useCallback(
    <T extends object>(style: T): T => {
      if (!isRTL) return style;

      const rtlMappings: Record<string, string> = {
        left: 'right',
        right: 'left',
        marginLeft: 'marginRight',
        marginRight: 'marginLeft',
        paddingLeft: 'paddingRight',
        paddingRight: 'paddingLeft',
        borderLeftWidth: 'borderRightWidth',
        borderRightWidth: 'borderLeftWidth',
        borderLeftColor: 'borderRightColor',
        borderRightColor: 'borderLeftColor',
        borderTopLeftRadius: 'borderTopRightRadius',
        borderTopRightRadius: 'borderTopLeftRadius',
        borderBottomLeftRadius: 'borderBottomRightRadius',
        borderBottomRightRadius: 'borderBottomLeftRadius',
      };

      const flipped: any = {};

      for (const [key, value] of Object.entries(style)) {
        const rtlKey = rtlMappings[key] || key;
        flipped[rtlKey] = value;

        // Handle flexDirection
        if (key === 'flexDirection') {
          if (value === 'row') flipped[key] = 'row-reverse';
          else if (value === 'row-reverse') flipped[key] = 'row';
        }

        // Handle textAlign
        if (key === 'textAlign') {
          if (value === 'left') flipped[key] = 'right';
          else if (value === 'right') flipped[key] = 'left';
        }
      }

      return flipped as T;
    },
    [isRTL]
  );

  const rtlValue = useCallback(
    <T>(ltr: T, rtl: T): T => {
      return isRTL ? rtl : ltr;
    },
    [isRTL]
  );

  const direction = isRTL ? 'rtl' : 'ltr';

  return {
    isRTL,
    direction,
    rtlStyle,
    rtlValue,
    I18nManager,
  };
}

// ============================================================================
// useFormatters - Formatting utilities hook
// ============================================================================

/**
 * React hook `useFormatters`.
 * @returns Hook state and actions.
 * @example
 * const value = useFormatters();
 */
export function useFormatters() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = i18n.addListener(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return i18n.formatNumber(value, options);
    },
    []
  );

  const formatCurrency = useCallback((value: number, currency?: string) => {
    return i18n.formatCurrency(value, currency);
  }, []);

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return i18n.formatDate(d, options);
    },
    []
  );

  const formatTime = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return i18n.formatTime(d, options);
    },
    []
  );

  const formatRelativeTime = useCallback((date: Date | string | number) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return i18n.formatRelativeTime(d);
  }, []);

  const formatDateRange = useCallback(
    (start: Date, end: Date) => {
      const startStr = i18n.formatDate(start, { month: 'short', day: 'numeric' });
      const endStr = i18n.formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    },
    []
  );

  return {
    formatNumber,
    formatCurrency,
    formatDate,
    formatTime,
    formatRelativeTime,
    formatDateRange,
  };
}

// ============================================================================
// useLocalizedContent - Get localized content based on language
// ============================================================================

export function useLocalizedContent<T>(
  content: Partial<Record<SupportedLanguage, T>>,
  fallback?: T
): T | undefined {
  const { language } = useLanguage();

  return useMemo(() => {
    return content[language] || content.en || fallback;
  }, [content, language, fallback]);
}

// ============================================================================
// TranslatedText Component Helper
// ============================================================================

interface TranslatedTextOptions {
  namespace?: string;
  params?: Record<string, string | number>;
}

/**
 * React hook `useTranslatedText`.
 * @param key - Hook parameter.
 * @param options? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useTranslatedText(key, options?);
 */
export function useTranslatedText(key: string, options?: TranslatedTextOptions) {
  const { t } = useTranslation(options?.namespace);
  return t(key, options?.params);
}

// ============================================================================
// Language Picker Helper
// ============================================================================

/**
 * React hook `useLanguagePicker`.
 * @returns Hook state and actions.
 * @example
 * const value = useLanguagePicker();
 */
export function useLanguagePicker() {
  const { language, supportedLanguages, setLanguage } = useLanguage();

  const options = useMemo(
    () =>
      supportedLanguages.map((lang) => ({
        value: lang.code,
        label: lang.nativeName,
        sublabel: lang.name,
        isSelected: lang.code === language,
      })),
    [supportedLanguages, language]
  );

  const selectLanguage = useCallback(
    async (code: string) => {
      if (i18n.isSupported(code)) {
        return setLanguage(code as SupportedLanguage);
      }
      return false;
    },
    [setLanguage]
  );

  return {
    currentLanguage: language,
    options,
    selectLanguage,
  };
}

export default {
  useTranslation,
  useLanguage,
  useRTL,
  useFormatters,
  useLocalizedContent,
  useTranslatedText,
  useLanguagePicker,
};

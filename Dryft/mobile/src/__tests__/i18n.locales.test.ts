import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import de from '../i18n/locales/de.json';
import ja from '../i18n/locales/ja.json';
import pt from '../i18n/locales/pt.json';
import it from '../i18n/locales/it.json';
import ko from '../i18n/locales/ko.json';
import zhCN from '../i18n/locales/zh-CN.json';

import { FALLBACK_CHAIN, SUPPORTED_LANGUAGES, isRTL } from '../i18n';

type LocaleMap = Record<string, unknown>;

type FlatMap = Record<string, string | number | boolean | null>;

function flatten(obj: LocaleMap, prefix = '', out: FlatMap = {}): FlatMap {
  Object.entries(obj).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as LocaleMap, path, out);
    } else {
      out[path] = value as FlatMap[string];
    }
  });
  return out;
}

describe('i18n locale integrity', () => {
  const locales: Record<string, LocaleMap> = {
    es,
    fr,
    de,
    ja,
    pt,
    it,
    ko,
    'zh-CN': zhCN,
  };

  test('all locales include all en keys', () => {
    const enKeys = Object.keys(flatten(en));

    Object.entries(locales).forEach(([locale, data]) => {
      const localeKeys = new Set(Object.keys(flatten(data)));
      const missing = enKeys.filter((key) => !localeKeys.has(key));

      if (missing.length > 0) {
        const sample = missing.slice(0, 20).join('\n');
        throw new Error(`${locale} missing ${missing.length} keys:\n${sample}`);
      }
    });
  });

  test('fallback chain includes zh -> en for zh-CN', () => {
    const chain = FALLBACK_CHAIN['zh-CN'];
    expect(chain).toEqual(['zh', 'en']);
    expect(FALLBACK_CHAIN.default).toEqual(['en']);
  });

  test('rtl detection is configured for rtl locales', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('he')).toBe(true);
    expect(isRTL('fa')).toBe(true);
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('en')).toBe(false);
  });

  test('rtl locale metadata snapshot remains stable', () => {
    const rtlLocaleSnapshot = (['ar', 'he', 'fa', 'ur'] as const).map((locale) => ({
      locale,
      metadata: SUPPORTED_LANGUAGES[locale],
      rtl: isRTL(locale),
    }));

    expect(rtlLocaleSnapshot).toMatchInlineSnapshot(`
      [
        {
          "locale": "ar",
          "metadata": {
            "flag": "🇸🇦",
            "name": "Arabic",
            "nativeName": "العربية",
          },
          "rtl": true,
        },
        {
          "locale": "he",
          "metadata": {
            "flag": "🇮🇱",
            "name": "Hebrew",
            "nativeName": "עברית",
          },
          "rtl": true,
        },
        {
          "locale": "fa",
          "metadata": {
            "flag": "🇮🇷",
            "name": "Persian",
            "nativeName": "فارسی",
          },
          "rtl": true,
        },
        {
          "locale": "ur",
          "metadata": {
            "flag": "🇵🇰",
            "name": "Urdu",
            "nativeName": "اردو",
          },
          "rtl": true,
        },
      ]
    `);
  });
});

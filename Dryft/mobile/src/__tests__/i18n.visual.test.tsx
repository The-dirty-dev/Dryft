import React from 'react';
import { View, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import i18n from '../i18n';
import { LanguageSelector } from '../components/LanguageSelector';
import { SUPPORTED_LANGUAGES } from '../i18n';

function LocalePreview() {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t('common.settings')}</Text>
      <Text>{t('onboarding.welcome')}</Text>
      <Text>{t('onboarding.tagline')}</Text>
      <Text>{t('settings.notifications')}</Text>
      <Text>{t('matches.newMatches')}</Text>
      <Text>{t('verification.title')}</Text>
    </View>
  );
}

describe('i18n visual smoke tests', () => {
  const locales = ['en', 'es', 'ja', 'pt', 'zh-CN'] as const;

  locales.forEach((locale) => {
    it(`renders key strings for ${locale}`, async () => {
      await act(async () => {
        await i18n.changeLanguage(locale);
      });

      const { getByText } = render(
        <View>
          <LanguageSelector />
          <LocalePreview />
        </View>
      );

      // Assert key strings render for the locale
      expect(getByText(i18n.t('common.settings'))).toBeTruthy();
      expect(getByText(i18n.t('onboarding.welcome'))).toBeTruthy();
      expect(getByText(i18n.t('onboarding.tagline'))).toBeTruthy();
      expect(getByText(i18n.t('settings.notifications'))).toBeTruthy();
      expect(getByText(i18n.t('matches.newMatches'))).toBeTruthy();
      expect(getByText(i18n.t('verification.title'))).toBeTruthy();

      // LanguageSelector shows current locale label
      const nativeName = SUPPORTED_LANGUAGES[locale].nativeName;
      expect(getByText(nativeName)).toBeTruthy();
    });
  });
});

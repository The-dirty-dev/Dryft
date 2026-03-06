import * as i18nHooks from '../../hooks/useI18n';

describe('useI18n hooks', () => {
  it('exports useTranslation', () => {
    expect(typeof i18nHooks.useTranslation).toBe('function');
  });

  it('exports useLanguage', () => {
    expect(typeof i18nHooks.useLanguage).toBe('function');
  });

  it('exports useLanguagePicker', () => {
    expect(typeof i18nHooks.useLanguagePicker).toBe('function');
  });
});

import i18n from '../../services/i18n';

describe('services/i18n', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.initialize();
  });

  it('resolves known translation keys', () => {
    const label = i18n.t('common.save');

    expect(label).toBe('Save');
  });

  it('falls back to key for missing translation', () => {
    const value = i18n.t('missing.path.key');

    expect(value).toBe('missing.path.key');
  });

  it('switches locale and supports pluralization', async () => {
    await i18n.setLanguage('es');

    expect(i18n.getLanguage()).toBe('es');
    expect(i18n.plural('time.minutesAgo', 2, { count: 2 })).toContain('2');
  });
});

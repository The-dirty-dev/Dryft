import { DEEP_LINK_CONFIG, parseDeepLink, generateDeepLink, generateAppLink } from '../../services/deepLinking';

describe('services/deepLinking', () => {
  it('exports deep link config', () => {
    expect(DEEP_LINK_CONFIG).toBeDefined();
    expect(typeof DEEP_LINK_CONFIG).toBe('object');
  });

  it('parses plain https links into share deep-link data', () => {
    const parsed = parseDeepLink('https://example.com');
    expect(parsed).toBeDefined();
    expect(parsed?.url).toBe('https://example.com');
  });

  it('generates app links', () => {
    const link = generateAppLink('profile', { userId: 'u1' });
    expect(typeof link).toBe('string');
    expect(link.length).toBeGreaterThan(0);
    expect(typeof generateDeepLink).toBe('function');
  });
});

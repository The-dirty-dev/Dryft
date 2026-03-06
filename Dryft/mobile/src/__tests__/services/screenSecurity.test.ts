import { screenSecurity, isSensitiveScreen, getSensitiveScreens } from '../../services/screenSecurity';

describe('services/screenSecurity', () => {
  it('exports screen security singleton', () => {
    expect(screenSecurity).toBeDefined();
  });

  it('exports sensitive-screen helpers', () => {
    expect(typeof isSensitiveScreen).toBe('function');
    expect(typeof getSensitiveScreens).toBe('function');
  });

  it('returns list of sensitive screens', () => {
    const screens = getSensitiveScreens();
    expect(Array.isArray(screens)).toBe(true);
  });
});

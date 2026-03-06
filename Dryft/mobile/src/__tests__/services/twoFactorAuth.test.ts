import twoFactorAuthService, { twoFactorAuthService as namedTwoFactorAuthService } from '../../services/twoFactorAuth';

describe('services/twoFactorAuth', () => {
  it('exports two-factor auth singleton', () => {
    expect(twoFactorAuthService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(twoFactorAuthService).toBe(namedTwoFactorAuthService);
  });

  it('exposes setup and verify methods', () => {
    expect(typeof (twoFactorAuthService as any).setupSMS).toBe('function');
    expect(typeof (twoFactorAuthService as any).verifyCode).toBe('function');
  });
});

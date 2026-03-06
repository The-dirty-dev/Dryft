import * as screenSecurityHooks from '../../hooks/useScreenSecurity';

describe('useScreenSecurity hooks', () => {
  it('exports useScreenSecurity', () => {
    expect(typeof screenSecurityHooks.useScreenSecurity).toBe('function');
  });

  it('exports useScreenCaptureAlert', () => {
    expect(typeof screenSecurityHooks.useScreenCaptureAlert).toBe('function');
  });

  it('exports usePreventScreenshot', () => {
    expect(typeof screenSecurityHooks.usePreventScreenshot).toBe('function');
  });
});

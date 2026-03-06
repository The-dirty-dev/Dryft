import * as appUpdateHooks from '../../hooks/useAppUpdate';

describe('useAppUpdate hooks', () => {
  it('exports useAppUpdate', () => {
    expect(typeof appUpdateHooks.useAppUpdate).toBe('function');
  });

  it('exports useVersionInfo', () => {
    expect(typeof appUpdateHooks.useVersionInfo).toBe('function');
  });

  it('exports useRequiredUpdate', () => {
    expect(typeof appUpdateHooks.useRequiredUpdate).toBe('function');
  });
});

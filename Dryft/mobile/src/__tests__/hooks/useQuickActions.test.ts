import * as quickActionHooks from '../../hooks/useQuickActions';

describe('useQuickActions hooks', () => {
  it('exports useQuickActions', () => {
    expect(typeof quickActionHooks.useQuickActions).toBe('function');
  });

  it('exports useQuickActionSetup', () => {
    expect(typeof quickActionHooks.useQuickActionSetup).toBe('function');
  });

  it('exports useQuickActionUpdates', () => {
    expect(typeof quickActionHooks.useQuickActionUpdates).toBe('function');
  });
});

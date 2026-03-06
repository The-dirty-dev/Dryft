import * as companionHooks from '../../hooks/useCompanionSession';

describe('useCompanionSession hook', () => {
  it('exports useCompanionSession', () => {
    expect(typeof companionHooks.useCompanionSession).toBe('function');
  });

  it('exposes a stable module', () => {
    expect(companionHooks).toBeDefined();
  });

  it('contains the named hook', () => {
    expect(Object.keys(companionHooks)).toContain('useCompanionSession');
  });
});

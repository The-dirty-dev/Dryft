import * as hapticHooks from '../../hooks/useHaptic';

describe('useHaptic hook', () => {
  it('exports useHaptic', () => {
    expect(typeof hapticHooks.useHaptic).toBe('function');
  });

  it('module loads without errors', () => {
    expect(hapticHooks).toBeDefined();
  });

  it('contains expected named export', () => {
    expect(Object.keys(hapticHooks)).toContain('useHaptic');
  });
});

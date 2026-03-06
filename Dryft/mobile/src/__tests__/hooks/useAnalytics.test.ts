import * as analyticsHooks from '../../hooks/useAnalytics';

describe('useAnalytics hooks', () => {
  it('exports useScreenTracking', () => {
    expect(typeof analyticsHooks.useScreenTracking).toBe('function');
  });

  it('exports useTrackedAction', () => {
    expect(typeof analyticsHooks.useTrackedAction).toBe('function');
  });

  it('exports useErrorTracking', () => {
    expect(typeof analyticsHooks.useErrorTracking).toBe('function');
  });
});

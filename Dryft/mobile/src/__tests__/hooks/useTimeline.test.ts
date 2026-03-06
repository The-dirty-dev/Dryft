import * as timelineHooks from '../../hooks/useTimeline';

describe('useTimeline hooks', () => {
  it('exports useTimeline', () => {
    expect(typeof timelineHooks.useTimeline).toBe('function');
  });

  it('exports useTimelineSummary', () => {
    expect(typeof timelineHooks.useTimelineSummary).toBe('function');
  });

  it('exports useThrowbacks', () => {
    expect(typeof timelineHooks.useThrowbacks).toBe('function');
  });
});

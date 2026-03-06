import * as creatorHooks from '../../hooks/useCreatorDashboard';

describe('useCreatorDashboard hooks', () => {
  it('exports useCreatorProfile', () => {
    expect(typeof creatorHooks.useCreatorProfile).toBe('function');
  });

  it('exports useEngagementStats', () => {
    expect(typeof creatorHooks.useEngagementStats).toBe('function');
  });

  it('exports useCreatorEarnings', () => {
    expect(typeof creatorHooks.useCreatorEarnings).toBe('function');
  });
});

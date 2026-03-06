import * as engagementHooks from '../../hooks/useEngagementMetrics';

describe('useEngagementMetrics hooks', () => {
  it('exports useEngagementMetrics', () => {
    expect(typeof engagementHooks.useEngagementMetrics).toBe('function');
  });

  it('exports useContentEngagement', () => {
    expect(typeof engagementHooks.useContentEngagement).toBe('function');
  });

  it('exports useUserJourney', () => {
    expect(typeof engagementHooks.useUserJourney).toBe('function');
  });
});

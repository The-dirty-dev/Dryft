import { analytics, trackEvent, trackScreen } from '../../services/analytics';

describe('services/analytics', () => {
  it('exports analytics singleton', () => {
    expect(analytics).toBeDefined();
  });

  it('exports trackEvent helper', () => {
    expect(typeof trackEvent).toBe('function');
  });

  it('exports trackScreen helper', () => {
    expect(typeof trackScreen).toBe('function');
  });
});

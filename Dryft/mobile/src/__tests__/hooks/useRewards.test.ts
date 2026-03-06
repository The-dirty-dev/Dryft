import * as rewardHooks from '../../hooks/useRewards';

describe('useRewards hooks', () => {
  it('exports useDailyRewards', () => {
    expect(typeof rewardHooks.useDailyRewards).toBe('function');
  });

  it('exports useRewardsLeaderboard', () => {
    expect(typeof rewardHooks.useRewardsLeaderboard).toBe('function');
  });

  it('exports useStreakStatus', () => {
    expect(typeof rewardHooks.useStreakStatus).toBe('function');
  });
});

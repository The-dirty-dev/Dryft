import {
  claimDailyReward,
  getDailyRewardStatus,
  getRewardsLeaderboard,
} from '../../services/rewards';

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

describe('services/rewards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches reward status', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { claimed_today: false, history: [] } });

    const result = await getDailyRewardStatus();

    expect(mockApiGet).toHaveBeenCalledWith('/v1/rewards/daily');
    expect(result.claimed_today).toBe(false);
  });

  it('claims daily reward', async () => {
    mockApiPost.mockResolvedValue({ success: true, data: { success: true, reward: { xp_earned: 10 } } });

    const result = await claimDailyReward();

    expect(mockApiPost).toHaveBeenCalledWith('/v1/rewards/daily/claim');
    expect(result.success).toBe(true);
  });

  it('requests leaderboard with type filter', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { type: 'xp', leaderboard: [] } });

    const result = await getRewardsLeaderboard('xp');

    expect(mockApiGet).toHaveBeenCalledWith('/v1/rewards/leaderboard?type=xp');
    expect(result.type).toBe('xp');
  });
});

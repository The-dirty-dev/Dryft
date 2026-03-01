import matchingApi from '../../api/matching';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  delete: jest.Mock;
};

describe('matchingApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests discover profiles with limit', async () => {
    mockClient.get.mockResolvedValue({ success: true });

    await matchingApi.getDiscoverProfiles(10);

    expect(mockClient.get).toHaveBeenCalledWith('/v1/discover?limit=10');
  });

  it('posts swipe action', async () => {
    mockClient.post.mockResolvedValue({ success: true });

    await matchingApi.swipe('user-1', 'like');

    expect(mockClient.post).toHaveBeenCalledWith('/v1/discover/swipe', {
      user_id: 'user-1',
      direction: 'like',
    });
  });

  it('fetches matches and unmatch', async () => {
    mockClient.get.mockResolvedValue({ success: true });
    mockClient.delete.mockResolvedValue({ success: true });

    await matchingApi.getMatches();
    await matchingApi.unmatch('match-1');

    expect(mockClient.get).toHaveBeenCalledWith('/v1/matches');
    expect(mockClient.delete).toHaveBeenCalledWith('/v1/matches/match-1');
  });
});

import safetyApi from '../../api/safety';
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

describe('safetyApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks and unblocks users', async () => {
    mockClient.post.mockResolvedValue({ success: true });
    mockClient.delete.mockResolvedValue({ success: true });

    await safetyApi.blockUser({ user_id: 'user-1', reason: 'spam' });
    await safetyApi.unblockUser('user-1');

    expect(mockClient.post).toHaveBeenCalledWith('/v1/safety/block', {
      user_id: 'user-1',
      reason: 'spam',
    });
    expect(mockClient.delete).toHaveBeenCalledWith('/v1/safety/block/user-1');
  });

  it('fetches reports and warnings', async () => {
    mockClient.get.mockResolvedValue({ success: true });

    await safetyApi.getMyReports();
    await safetyApi.getWarnings();

    expect(mockClient.get).toHaveBeenCalledWith('/v1/safety/reports');
    expect(mockClient.get).toHaveBeenCalledWith('/v1/safety/warnings');
  });
});

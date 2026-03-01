import profileApi from '../../api/profile';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: jest.Mock;
  patch: jest.Mock;
};

describe('profileApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches profile', async () => {
    mockClient.get.mockResolvedValue({ success: true });

    await profileApi.getProfile();

    expect(mockClient.get).toHaveBeenCalledWith('/v1/profile');
  });

  it('updates profile', async () => {
    mockClient.patch.mockResolvedValue({ success: true });

    await profileApi.updateProfile({ bio: 'New bio' });

    expect(mockClient.patch).toHaveBeenCalledWith('/v1/profile', { bio: 'New bio' });
  });
});

import callsApi from '../../api/calls';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: jest.Mock;
  post: jest.Mock;
};

describe('callsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initiates and ends calls', async () => {
    mockClient.post.mockResolvedValue({ success: true });

    await callsApi.initiateCall({ match_id: 'match-1', video_enabled: true });
    await callsApi.endCall('call-1');

    expect(mockClient.post).toHaveBeenCalledWith('/v1/calls/initiate', {
      match_id: 'match-1',
      video_enabled: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith('/v1/calls/call-1/end');
  });

  it('fetches active call and history', async () => {
    mockClient.get.mockResolvedValue({ success: true });

    await callsApi.getActiveCall();
    await callsApi.getCallHistory();

    expect(mockClient.get).toHaveBeenCalledWith('/v1/calls/active');
    expect(mockClient.get).toHaveBeenCalledWith('/v1/calls/history');
  });
});

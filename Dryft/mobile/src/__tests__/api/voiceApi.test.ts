import voiceApi from '../../api/voice';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: jest.Mock;
};

describe('voiceApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches session participants', async () => {
    mockClient.get.mockResolvedValue({ success: true });

    await voiceApi.getParticipants('session-1');

    expect(mockClient.get).toHaveBeenCalledWith('/v1/voice/session/session-1/participants');
  });
});

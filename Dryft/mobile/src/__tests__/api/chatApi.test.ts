import chatApi from '../../api/chat';
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

describe('chatApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads conversations and messages', async () => {
    mockClient.get.mockResolvedValue({ success: true });

    await chatApi.getConversations();
    await chatApi.getMessages('match-1');

    expect(mockClient.get).toHaveBeenCalledWith('/v1/chat/conversations');
    expect(mockClient.get).toHaveBeenCalledWith('/v1/chat/match-1/messages');
  });

  it('sends message and marks as read', async () => {
    mockClient.post.mockResolvedValue({ success: true });

    await chatApi.sendMessage('match-2', 'Hello', 'text');
    await chatApi.markAsRead('match-2');

    expect(mockClient.post).toHaveBeenCalledWith('/v1/chat/match-2/messages', {
      content: 'Hello',
      type: 'text',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/v1/chat/match-2/read');
  });
});

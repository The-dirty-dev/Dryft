import { vi } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  apiClient: mockApiClient,
  default: mockApiClient,
}));

let useChatStore: (typeof import('./chatStore'))['useChatStore'];

const resetState = () =>
  useChatStore.setState(
    {
      conversations: [],
      isLoadingConversations: false,
      conversationsError: null,
      currentConversationId: null,
      messages: [],
      isLoadingMessages: false,
      messagesError: null,
      isSendingMessage: false,
      typingUsers: {},
    },
    false
  );

describe('chatStore', () => {
  beforeAll(async () => {
    ({ useChatStore } = await import('./chatStore'));
  });

  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    resetState();
  });

  it('loads conversations into state', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: { conversations: [{ id: 'conv-1', unread_count: 2 }] },
    });

    await useChatStore.getState().loadConversations();

    const state = useChatStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.isLoadingConversations).toBe(false);
  });

  it('loads messages and sets current conversation', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: { messages: [{ id: 'msg-1', conversation_id: 'conv-1' }] },
    });

    await useChatStore.getState().loadMessages('conv-1');

    const state = useChatStore.getState();
    expect(state.currentConversationId).toBe('conv-1');
    expect(state.messages).toHaveLength(1);
  });

  it('sends a message and updates conversation last message', async () => {
    mockApiClient.post.mockResolvedValue({
      success: true,
      data: {
        id: 'msg-2',
        conversation_id: 'conv-2',
        content: 'Hello',
        created_at: new Date().toISOString(),
      },
    });

    useChatStore.setState(
      {
        ...useChatStore.getState(),
        conversations: [{ id: 'conv-2', unread_count: 0 }],
      },
      false
    );

    const result = await useChatStore.getState().sendMessage('conv-2', 'Hello');

    const state = useChatStore.getState();
    expect(result).toBe(true);
    expect(state.messages).toHaveLength(1);
    expect(state.conversations[0].last_message?.id).toBe('msg-2');
  });

  it('marks a conversation as read', async () => {
    mockApiClient.post.mockResolvedValue({ success: true });
    useChatStore.setState(
      {
        ...useChatStore.getState(),
        conversations: [{ id: 'conv-3', unread_count: 3 }],
      },
      false
    );

    await useChatStore.getState().markAsRead('conv-3');

    const state = useChatStore.getState();
    expect(state.conversations[0].unread_count).toBe(0);
  });
});

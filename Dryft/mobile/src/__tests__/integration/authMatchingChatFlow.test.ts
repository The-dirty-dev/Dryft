const mockLogin = jest.fn();

jest.mock('../../api/auth', () => {
  const api = {
    login: mockLogin,
    register: jest.fn(),
    getCurrentUser: jest.fn(),
    initialize: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    getSessions: jest.fn(),
    revokeSession: jest.fn(),
    changePassword: jest.fn(),
    refreshToken: jest.fn(),
    deleteAccount: jest.fn(),
    updateProfile: jest.fn(),
  };

  return {
    __esModule: true,
    default: api,
    authApi: api,
  };
});

jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}), { virtual: true });

// Late require to ensure mocks are registered first
const { useAuthStore } = require('../../store/authStore') as any;
const { useMatchingStore } = require('../../store/matchingStore') as any;

describe('auth -> matching -> chat flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isVerified: false,
      isLoading: false,
      error: null,
      sessions: [],
    }, false);

    useMatchingStore.setState({
      discoverProfiles: [],
      currentProfileIndex: 0,
      isLoadingDiscover: false,
      matches: [],
      isLoadingMatches: false,
      conversations: [],
      isLoadingConversations: false,
      currentMessages: [],
      isLoadingMessages: false,
      isSendingMessage: false,
      loadDiscoverProfiles: useMatchingStore.getState().loadDiscoverProfiles,
      swipe: useMatchingStore.getState().swipe,
      nextProfile: useMatchingStore.getState().nextProfile,
      loadMatches: useMatchingStore.getState().loadMatches,
      unmatch: useMatchingStore.getState().unmatch,
      loadConversations: useMatchingStore.getState().loadConversations,
      loadMessages: useMatchingStore.getState().loadMessages,
      sendMessage: useMatchingStore.getState().sendMessage,
      markAsRead: useMatchingStore.getState().markAsRead,
    }, false);
  });

  it('logs in and loads matches + messages', async () => {
    const { api } = jest.requireMock('../../services/api');

    mockLogin.mockResolvedValue({
      success: true,
      data: {
        user: {
          id: 'user-1',
          email: 'user@dryft.site',
          verified: true,
          created_at: '2026-02-09T00:00:00Z',
        },
        tokens: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          expires_at: 999999,
        },
      },
    });

    api.get
      .mockResolvedValueOnce({
        data: {
          matches: [
            {
              id: 'match-1',
              user: { id: 'user-2', display_name: 'Riley' },
              matched_at: '2026-02-09T00:00:00Z',
              unread_count: 1,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: { messages: [] },
      });

    api.post.mockResolvedValue({
      data: {
        id: 'msg-1',
        match_id: 'match-1',
        content: 'Hello',
        type: 'text',
        created_at: '2026-02-09T00:00:00Z',
      },
    });

    const loginResult = await useAuthStore.getState().login('user@dryft.site', 'password');
    expect(loginResult).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    await useMatchingStore.getState().loadMatches();
    expect(useMatchingStore.getState().matches).toHaveLength(1);

    await useMatchingStore.getState().loadMessages('match-1');
    expect(useMatchingStore.getState().currentMessages).toHaveLength(0);

    const sendResult = await useMatchingStore.getState().sendMessage('match-1', 'Hello');
    expect(sendResult).toBe(true);
    expect(useMatchingStore.getState().currentMessages).toHaveLength(1);
  });
});

export {};

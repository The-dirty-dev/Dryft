let useMatchingStore: typeof import('../store/matchingStore').useMatchingStore;

jest.mock(
  '../services/api',
  () => ({
    __esModule: true,
    api: {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    },
  }),
  { virtual: true }
);

const getMockApi = () =>
  (jest.requireMock('../services/api') as {
    api: { get: jest.Mock; post: jest.Mock; delete: jest.Mock };
  }).api;

const baseState = {
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
};

describe('matchingStore', () => {
  beforeAll(() => {
    ({ useMatchingStore } = require('../store/matchingStore'));
  });

  beforeEach(() => {
    const api = getMockApi();
    api.get.mockReset();
    api.post.mockReset();
    api.delete.mockReset();
    useMatchingStore.setState(baseState, false);
  });

  it('loads discover profiles and resets index', async () => {
    const api = getMockApi();
    api.get.mockResolvedValue({
      data: {
        profiles: [{ id: 'profile-1' }, { id: 'profile-2' }],
      },
    });

    await useMatchingStore.getState().loadDiscoverProfiles();

    const state = useMatchingStore.getState();
    expect(state.discoverProfiles).toHaveLength(2);
    expect(state.currentProfileIndex).toBe(0);
    expect(state.isLoadingDiscover).toBe(false);
  });

  it('advances to the next profile when requested', async () => {
    const api = getMockApi();
    api.get.mockResolvedValue({
      data: {
        profiles: [{ id: 'profile-5' }],
      },
    });
    useMatchingStore.setState(
      {
        ...baseState,
        discoverProfiles: [
          { id: 'profile-1' },
          { id: 'profile-2' },
          { id: 'profile-3' },
          { id: 'profile-4' },
        ] as any[],
        currentProfileIndex: 0,
      },
      false
    );

    useMatchingStore.getState().nextProfile();

    expect(useMatchingStore.getState().currentProfileIndex).toBe(1);
  });

  it('unmatches and removes conversations for the match', async () => {
    const api = getMockApi();
    api.delete.mockResolvedValue({ data: { success: true } });
    useMatchingStore.setState(
      {
        ...baseState,
        matches: [{ id: 'match-1' }, { id: 'match-2' }] as any[],
        conversations: [
          { match_id: 'match-1', unread_count: 2 },
          { match_id: 'match-2', unread_count: 1 },
        ] as any[],
      },
      false
    );

    const result = await useMatchingStore.getState().unmatch('match-1');

    const state = useMatchingStore.getState();
    expect(result).toBe(true);
    expect(state.matches).toHaveLength(1);
    expect(state.matches[0].id).toBe('match-2');
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].match_id).toBe('match-2');
  });

  it('sends a message and appends it to currentMessages', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: {
        id: 'message-1',
        match_id: 'match-3',
        content: 'Hello',
      },
    });

    const result = await useMatchingStore.getState().sendMessage('match-3', 'Hello');

    const state = useMatchingStore.getState();
    expect(result).toBe(true);
    expect(state.currentMessages).toHaveLength(1);
    expect(state.currentMessages[0].id).toBe('message-1');
    expect(state.isSendingMessage).toBe(false);
  });

  it('returns false when sending a message fails', async () => {
    const api = getMockApi();
    api.post.mockRejectedValue(new Error('Network error'));

    const result = await useMatchingStore.getState().sendMessage('match-4', 'Hi');

    const state = useMatchingStore.getState();
    expect(result).toBe(false);
    expect(state.currentMessages).toHaveLength(0);
    expect(state.isSendingMessage).toBe(false);
  });

  it('stops loading when matches fail to load', async () => {
    const api = getMockApi();
    api.get.mockRejectedValue(new Error('Network error'));

    await useMatchingStore.getState().loadMatches();

    const state = useMatchingStore.getState();
    expect(state.isLoadingMatches).toBe(false);
  });

  it('marks conversations as read', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({ data: { success: true } });
    useMatchingStore.setState(
      {
        ...baseState,
        conversations: [
          { match_id: 'match-9', unread_count: 3 },
          { match_id: 'match-10', unread_count: 1 },
        ] as any[],
      },
      false
    );

    await useMatchingStore.getState().markAsRead('match-9');

    const state = useMatchingStore.getState();
    expect(state.conversations[0].unread_count).toBe(0);
    expect(state.conversations[1].unread_count).toBe(1);
  });
});

export {};

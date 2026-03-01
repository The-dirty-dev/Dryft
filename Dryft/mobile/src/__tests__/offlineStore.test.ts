import { useOfflineStore } from '../store/offlineStore';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
}));

jest.mock('../api/client', () => ({
  __esModule: true,
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const getMockApi = () =>
  (jest.requireMock('../api/client') as {
    api: { get: jest.Mock; post: jest.Mock; put: jest.Mock };
  }).api;

const baseState = {
  isOnline: true,
  connectionType: null,
  lastOnlineAt: null,
  actionQueue: [],
  isProcessingQueue: false,
  lastSyncAt: null,
  cachedProfiles: [],
  cachedMatches: [],
  cachedMessages: {},
  maxCachedProfiles: 50,
  maxCachedMessages: 100,
  cacheExpiryMs: 24 * 60 * 60 * 1000,
};

describe('offlineStore', () => {
  beforeEach(() => {
    const api = getMockApi();
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    useOfflineStore.setState(baseState, false);
  });

  it('queues actions and prioritizes higher priority work', () => {
    useOfflineStore.setState({ isOnline: false }, false);

    useOfflineStore.getState().queueAction({
      type: 'like',
      payload: { userId: 'user-1' },
      priority: 1,
      maxRetries: 3,
    });

    useOfflineStore.getState().queueAction({
      type: 'pass',
      payload: { userId: 'user-2' },
      priority: 10,
      maxRetries: 3,
    });

    const state = useOfflineStore.getState();
    expect(state.actionQueue).toHaveLength(2);
    expect(state.actionQueue[0].type).toBe('pass');
    expect(state.actionQueue[0].priority).toBe(10);
    expect(state.actionQueue[0].retryCount).toBe(0);
    expect(state.actionQueue[0].maxRetries).toBeGreaterThan(0);
    expect(typeof state.actionQueue[0].createdAt).toBe('number');
  });

  it('processes queued actions when online', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({ data: { success: true } });

    useOfflineStore.setState(
      {
        isOnline: true,
        actionQueue: [
          {
            id: 'action-1',
            type: 'like',
            payload: { userId: 'user-1' },
            createdAt: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            priority: 0,
          },
        ],
      },
      false
    );

    await useOfflineStore.getState().processQueue();

    const state = useOfflineStore.getState();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(state.actionQueue).toHaveLength(0);
    expect(state.isProcessingQueue).toBe(false);
    expect(state.lastSyncAt).not.toBeNull();
  });

  it('retains failed actions with incremented retry count', async () => {
    const api = getMockApi();
    api.post.mockRejectedValue(new Error('Network error'));

    useOfflineStore.setState(
      {
        isOnline: true,
        actionQueue: [
          {
            id: 'action-2',
            type: 'like',
            payload: { userId: 'user-2' },
            createdAt: Date.now(),
            retryCount: 0,
            maxRetries: 2,
            priority: 0,
          },
        ],
      },
      false
    );

    await useOfflineStore.getState().processQueue();

    const state = useOfflineStore.getState();
    expect(state.actionQueue).toHaveLength(1);
    expect(state.actionQueue[0].retryCount).toBe(1);
  });

  it('filters expired cached profiles', () => {
    const now = Date.now();
    useOfflineStore.setState(
      {
        cacheExpiryMs: 1000,
        cachedProfiles: [
          {
            id: 'fresh',
            name: 'Fresh',
            age: 28,
            photos: [],
            bio: '',
            cachedAt: now,
          },
          {
            id: 'stale',
            name: 'Stale',
            age: 31,
            photos: [],
            bio: '',
            cachedAt: now - 2000,
          },
        ],
      },
      false
    );

    const profiles = useOfflineStore.getState().getCachedProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('fresh');
  });

  it('limits cached messages and updates message status', () => {
    useOfflineStore.setState({ maxCachedMessages: 2 }, false);

    useOfflineStore.getState().cacheMessages('match-1', [
      {
        id: 'm1',
        matchId: 'match-1',
        senderId: 'user-1',
        content: 'a',
        createdAt: 1,
        status: 'sent',
      },
      {
        id: 'm2',
        matchId: 'match-1',
        senderId: 'user-1',
        content: 'b',
        createdAt: 2,
        status: 'sent',
      },
      {
        id: 'm3',
        matchId: 'match-1',
        senderId: 'user-1',
        content: 'c',
        createdAt: 3,
        status: 'sent',
      },
    ]);

    let state = useOfflineStore.getState();
    expect(state.cachedMessages['match-1']).toHaveLength(2);
    expect(state.cachedMessages['match-1'].map((m) => m.id)).toEqual([
      'm2',
      'm3',
    ]);

    useOfflineStore.getState().updateMessageStatus('match-1', 'm3', 'read');

    state = useOfflineStore.getState();
    const updated = state.cachedMessages['match-1'].find((m) => m.id === 'm3');
    expect(updated?.status).toBe('read');
  });

  it('syncs cached matches from the API response when online', async () => {
    const api = getMockApi();
    api.get.mockResolvedValue({
      data: {
        matches: [
          {
            id: 'match-1',
            other_user: {
              id: 'user-2',
              display_name: 'Sam',
              profile_photo: 'photo.jpg',
            },
            last_message: 'Hi',
            last_message_at: '2024-01-01T00:00:00Z',
            unread_count: 2,
          },
        ],
      },
    });

    useOfflineStore.setState({ isOnline: true }, false);

    await useOfflineStore.getState().syncData();

    const state = useOfflineStore.getState();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(state.cachedMatches).toHaveLength(1);
    expect(state.cachedMatches[0].matchedUserId).toBe('user-2');
    expect(state.cachedMatches[0].matchedUserName).toBe('Sam');
    expect(state.cachedMatches[0].matchedUserPhoto).toBe('photo.jpg');
  });
});

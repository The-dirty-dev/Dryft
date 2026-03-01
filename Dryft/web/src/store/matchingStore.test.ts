import { vi } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  apiClient: mockApiClient,
  default: mockApiClient,
}));

let useMatchingStore: (typeof import('./matchingStore'))['useMatchingStore'];

const resetState = () =>
  useMatchingStore.setState(
    {
      discoverProfiles: [],
      currentProfileIndex: 0,
      isLoadingDiscover: false,
      discoverError: null,
      matches: [],
      isLoadingMatches: false,
      matchesError: null,
    },
    false
  );

describe('matchingStore', () => {
  beforeAll(async () => {
    ({ useMatchingStore } = await import('./matchingStore'));
  });

  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    mockApiClient.delete.mockReset();
    resetState();
  });

  it('loads discover profiles successfully', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: { profiles: [{ id: 'profile-1' }] },
    });

    await useMatchingStore.getState().loadDiscoverProfiles();

    const state = useMatchingStore.getState();
    expect(state.discoverProfiles).toHaveLength(1);
    expect(state.isLoadingDiscover).toBe(false);
  });

  it('sets matches error on load failure', async () => {
    mockApiClient.get.mockResolvedValue({
      success: false,
      error: 'Failed to load matches',
    });

    await useMatchingStore.getState().loadMatches();

    const state = useMatchingStore.getState();
    expect(state.matchesError).toBe('Failed to load matches');
    expect(state.isLoadingMatches).toBe(false);
  });

  it('unmatches and removes match from state', async () => {
    mockApiClient.delete.mockResolvedValue({ success: true });
    useMatchingStore.setState(
      {
        ...useMatchingStore.getState(),
        matches: [{ id: 'match-1' }, { id: 'match-2' }],
      },
      false
    );

    const result = await useMatchingStore.getState().unmatch('match-1');

    const state = useMatchingStore.getState();
    expect(result).toBe(true);
    expect(state.matches).toHaveLength(1);
    expect(state.matches[0].id).toBe('match-2');
  });
});

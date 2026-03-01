import { renderHook, act } from '@testing-library/react-hooks';

const defaultFilters = {
  ageRange: [18, 50],
  distance: 50,
  distanceUnit: 'mi',
  genderPreference: [],
  height: null,
  heightUnit: 'ft',
  relationshipGoals: [],
  hasChildren: 'any',
  wantsChildren: 'any',
  smoking: 'any',
  drinking: 'any',
  exercise: 'any',
  interests: [],
  languages: [],
  education: 'any',
  verificationStatus: 'any',
  activityStatus: 'any',
  hasPhotos: 1,
  hasBio: false,
  vrExperience: 'any',
  vrHeadset: [],
  hideProfiles: [],
  dealbreakers: [],
  sortBy: 'distance',
};

const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockGetFilters = jest.fn();
const mockUpdateFilters = jest.fn().mockResolvedValue(undefined);
const mockResetFilters = jest.fn().mockResolvedValue(undefined);
const mockSubscribe = jest.fn();
const mockGetActiveFilterCount = jest.fn();
const mockGetFilterStats = jest.fn();

jest.mock('../../services/discoveryFilters', () => ({
  discoveryFiltersService: {
    initialize: mockInitialize,
    getFilters: mockGetFilters,
    updateFilters: mockUpdateFilters,
    resetFilters: mockResetFilters,
    subscribe: mockSubscribe,
    getActiveFilterCount: mockGetActiveFilterCount,
    getFilterStats: mockGetFilterStats,
  },
  DEFAULT_FILTERS: defaultFilters,
}));

// Late require to ensure mocks are registered first
const { useDiscoveryFilters, useFilterStats } = require('../../hooks/useDiscoveryFilters') as any;

describe('useDiscoveryFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribe.mockReturnValue(jest.fn());
    mockGetFilters.mockReturnValue(defaultFilters);
    mockGetActiveFilterCount.mockReturnValue(2);
  });

  it('loads filters and tracks local changes', async () => {
    const { result } = renderHook(() => useDiscoveryFilters());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeFilterCount).toBe(2);

    act(() => {
      result.current.setLocalFilters({ distance: 10 });
    });

    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.applyLocalFilters();
    });

    expect(mockUpdateFilters).toHaveBeenCalledWith(
      expect.objectContaining({ distance: 10 })
    );
  });
});

describe('useFilterStats', () => {
  it('fetches filter stats', async () => {
    mockGetFilterStats.mockResolvedValue({
      matchingProfiles: 3,
      totalProfiles: 20,
      lastUpdated: '2026-02-09T00:00:00Z',
    });

    const { result } = renderHook(() => useFilterStats());

    await act(async () => {
      await result.current.fetchStats();
    });

    expect(result.current.stats?.matchingProfiles).toBe(3);
    expect(result.current.isLoading).toBe(false);
  });
});

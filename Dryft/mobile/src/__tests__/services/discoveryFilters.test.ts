import discoveryFiltersService from '../../services/discoveryFilters';

jest.mock('../../services/api', () => ({
  api: {
    post: jest.fn(),
  },
}), { virtual: true });

jest.mock('../../services/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('discoveryFiltersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns filter stats from the API', async () => {
    const { api } = jest.requireMock('../../services/api');
    api.post.mockResolvedValue({
      data: {
        matchingProfiles: 12,
        totalProfiles: 100,
        lastUpdated: '2026-02-09T00:00:00Z',
      },
    });

    const stats = await discoveryFiltersService.getFilterStats();

    expect(api.post).toHaveBeenCalledWith('/v1/discovery/filter-stats', {
      filters: expect.any(Object),
    });
    expect(stats.matchingProfiles).toBe(12);
  });

  it('falls back when stats request fails', async () => {
    const { api } = jest.requireMock('../../services/api');
    api.post.mockRejectedValue(new Error('fail'));

    const stats = await discoveryFiltersService.getFilterStats();

    expect(stats.matchingProfiles).toBe(0);
    expect(stats.totalProfiles).toBe(0);
  });
});

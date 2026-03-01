import { vi } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const mockApi = vi.hoisted(() => ({
  getStoreItems: vi.fn(),
  purchaseItem: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  apiClient: mockApiClient,
  api: mockApi,
  default: mockApiClient,
}));

let useMarketplaceStore: (typeof import('./marketplaceStore'))['useMarketplaceStore'];

const resetState = () =>
  useMarketplaceStore.setState(
    {
      storeItems: [],
      isLoadingStore: false,
      storeError: null,
      storeTotal: 0,
      storeOffset: 0,
      featuredItems: [],
      popularItems: [],
      currentItem: null,
      isLoadingItem: false,
      inventory: [],
      isLoadingInventory: false,
      inventoryError: null,
      isPurchasing: false,
      purchaseError: null,
      searchQuery: '',
      selectedType: null,
      selectedCategoryId: null,
    },
    false
  );

describe('marketplaceStore', () => {
  beforeAll(async () => {
    ({ useMarketplaceStore } = await import('./marketplaceStore'));
  });

  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    mockApi.getStoreItems.mockReset();
    mockApi.purchaseItem.mockReset();
    resetState();
  });

  it('loads store items and updates pagination state', async () => {
    mockApi.getStoreItems.mockResolvedValue({
      success: true,
      data: { items: [{ id: 'item-1' }], total: 1 },
    });

    await useMarketplaceStore.getState().loadStoreItems();

    const state = useMarketplaceStore.getState();
    expect(state.storeItems).toHaveLength(1);
    expect(state.storeTotal).toBe(1);
    expect(state.storeOffset).toBe(1);
  });

  it('does not load more items when already at end', async () => {
    useMarketplaceStore.setState(
      {
        ...useMarketplaceStore.getState(),
        storeOffset: 10,
        storeTotal: 10,
      },
      false
    );

    await useMarketplaceStore.getState().loadMoreItems();

    expect(mockApi.getStoreItems).not.toHaveBeenCalled();
  });

  it('marks item owned on purchase success', async () => {
    mockApi.purchaseItem.mockResolvedValue({
      success: true,
      data: { purchase_id: 'purchase-1', amount: 499, currency: 'usd' },
    });
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: { items: [] },
    });

    useMarketplaceStore.setState(
      {
        ...useMarketplaceStore.getState(),
        storeItems: [{ id: 'item-2', is_owned: false }],
      },
      false
    );

    const result = await useMarketplaceStore.getState().purchaseItem('item-2');

    const state = useMarketplaceStore.getState();
    expect(result?.purchase_id).toBe('purchase-1');
    expect(state.storeItems[0].is_owned).toBe(true);
    expect(state.isPurchasing).toBe(false);
  });
});

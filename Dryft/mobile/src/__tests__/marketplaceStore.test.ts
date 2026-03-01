const mockGetItems = jest.fn();
const mockPurchase = jest.fn();
const mockGetFeaturedItems = jest.fn();

jest.mock('../api/marketplace', () => {
  const api = {
    getItems: mockGetItems,
    getFeaturedItems: mockGetFeaturedItems,
    getPopularItems: jest.fn(),
    getCategories: jest.fn(),
    searchItems: jest.fn(),
    getInventory: jest.fn(),
    getEquippedItems: jest.fn(),
    equipItem: jest.fn(),
    unequipItem: jest.fn(),
    purchase: mockPurchase,
  };

  return {
    __esModule: true,
    default: api,
    marketplaceApi: api,
  };
});

// Late require: babel-preset-expo doesn't hoist jest.mock above imports
const { useMarketplaceStore } = require('../store/marketplaceStore') as any;

describe('marketplaceStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMarketplaceStore.setState({
      items: [],
      featuredItems: [],
      popularItems: [],
      categories: [],
      currentFilter: {},
      totalItems: 0,
      currentPage: 0,
      isLoadingStore: false,
      inventory: [],
      equippedItems: {
        avatar: null,
        outfit: null,
        toy: null,
        effect: null,
        gesture: null,
      },
      isLoadingInventory: false,
      selectedItem: null,
      error: null,
      loadItems: useMarketplaceStore.getState().loadItems,
      loadFeaturedItems: useMarketplaceStore.getState().loadFeaturedItems,
      loadPopularItems: useMarketplaceStore.getState().loadPopularItems,
      loadCategories: useMarketplaceStore.getState().loadCategories,
      searchItems: useMarketplaceStore.getState().searchItems,
      setFilter: useMarketplaceStore.getState().setFilter,
      selectItem: useMarketplaceStore.getState().selectItem,
      loadInventory: useMarketplaceStore.getState().loadInventory,
      loadEquippedItems: useMarketplaceStore.getState().loadEquippedItems,
      equipItem: useMarketplaceStore.getState().equipItem,
      unequipItem: useMarketplaceStore.getState().unequipItem,
      purchaseItem: useMarketplaceStore.getState().purchaseItem,
      clearError: useMarketplaceStore.getState().clearError,
    }, false);
  });

  it('loads items and sets pagination state', async () => {
    mockGetItems.mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'item-1', name: 'Neon Avatar', item_type: 'avatar', price: 0, currency: 'usd' },
        ],
        total: 1,
      },
    });

    await useMarketplaceStore.getState().loadItems({}, 0);

    const state = useMarketplaceStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.totalItems).toBe(1);
    expect(state.isLoadingStore).toBe(false);
  });

  it('sets filter and triggers loadItems', () => {
    const loadItemsSpy = jest.spyOn(useMarketplaceStore.getState(), 'loadItems');

    useMarketplaceStore.getState().setFilter({ search: 'glow' });

    expect(loadItemsSpy).toHaveBeenCalledWith({ search: 'glow' }, 0);
  });

  it('purchases an item and returns client secret', async () => {
    mockPurchase.mockResolvedValue({
      success: true,
      data: { client_secret: 'secret-123' },
    });

    const result = await useMarketplaceStore.getState().purchaseItem('item-1');

    expect(result.success).toBe(true);
    expect(result.clientSecret).toBe('secret-123');
  });
});

export {};

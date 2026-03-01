const mockLogin = jest.fn();
const mockGetFeaturedItems = jest.fn();
const mockPurchase = jest.fn();
const mockGetItems = jest.fn();

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

jest.mock('../../api/marketplace', () => {
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

// Late require to ensure mocks are registered first
const { useAuthStore } = require('../../store/authStore') as any;
const { useMarketplaceStore } = require('../../store/marketplaceStore') as any;

describe('auth + marketplace flow', () => {
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

  it('logs in then loads featured items and purchases', async () => {
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

    mockGetFeaturedItems.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'item-1',
            name: 'Neon Avatar',
            item_type: 'avatar',
            price: 0,
            currency: 'usd',
          },
        ],
      },
    });

    mockGetItems.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'item-2',
            name: 'Glow Outfit',
            item_type: 'outfit',
            price: 499,
            currency: 'usd',
          },
        ],
        total: 1,
      },
    });

    mockPurchase.mockResolvedValue({
      success: true,
      data: { client_secret: 'secret-123' },
    });

    const loginResult = await useAuthStore.getState().login('user@dryft.site', 'password');
    expect(loginResult).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    await useMarketplaceStore.getState().loadFeaturedItems();
    expect(useMarketplaceStore.getState().featuredItems).toHaveLength(1);

    await useMarketplaceStore.getState().loadItems({}, 0);
    expect(useMarketplaceStore.getState().items).toHaveLength(1);

    const purchaseResult = await useMarketplaceStore.getState().purchaseItem('item-2');
    expect(purchaseResult.success).toBe(true);
    expect(purchaseResult.clientSecret).toBe('secret-123');
  });
});

export {};

import { useSubscriptionStore } from '../../store/subscriptionStore';

const mockInitialize = jest.fn(async () => undefined);
const mockFetchOfferings = jest.fn(async () => [
  {
    availablePackages: [
      {
        product: {
          identifier: 'dryft_plus_monthly',
          title: 'Dryft+',
          description: 'Plus tier',
          priceString: '$14.99',
          price: 14.99,
          currencyCode: 'USD',
          productCategory: 'SUBSCRIPTION',
        },
      },
    ],
  },
]);
const mockTransformPackageToProduct = jest.fn(() => ({
  id: 'dryft_plus_monthly',
  title: 'Dryft+',
  description: 'Plus tier',
  price: '$14.99',
  priceNumber: 14.99,
  currency: 'USD',
  period: 'P1M',
  tier: 'plus',
}));
const mockPurchaseProduct = jest.fn(async () => ({ success: true }));
const mockRestorePurchases = jest.fn(async () => ({ success: true }));

const mockApiGet = jest.fn(async () => ({
  data: {
    subscription: {
      tier: 'plus',
      product_id: 'dryft_plus_monthly',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      will_renew: true,
      purchase_date: new Date().toISOString(),
      platform: 'ios',
    },
    boosts_remaining: 1,
    super_likes_remaining: 2,
  },
}));

jest.mock('../../services/purchases', () => ({
  __esModule: true,
  default: {
    initialize: (...args: any[]) => mockInitialize(...args),
    fetchOfferings: (...args: any[]) => mockFetchOfferings(...args),
    transformPackageToProduct: (...args: any[]) => mockTransformPackageToProduct(...args),
    purchaseProduct: (...args: any[]) => mockPurchaseProduct(...args),
    restorePurchases: (...args: any[]) => mockRestorePurchases(...args),
  },
}));

jest.mock('../../api/client', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: jest.fn(),
  },
  apiClient: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}));

describe('store/subscriptionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes by calling purchases service methods', async () => {
    await useSubscriptionStore.getState().initialize();

    expect(mockInitialize).toHaveBeenCalled();
    expect(mockFetchOfferings).toHaveBeenCalled();
    expect(mockApiGet).toHaveBeenCalledWith('/subscriptions/status');
  });

  it('delegates purchase flow to purchases service', async () => {
    const success = await useSubscriptionStore.getState().purchaseProduct('dryft_plus_monthly');

    expect(mockPurchaseProduct).toHaveBeenCalledWith('dryft_plus_monthly');
    expect(success).toBe(true);
  });

  it('delegates restore flow to purchases service', async () => {
    await useSubscriptionStore.getState().restorePurchases();

    expect(mockRestorePurchases).toHaveBeenCalled();
  });
});

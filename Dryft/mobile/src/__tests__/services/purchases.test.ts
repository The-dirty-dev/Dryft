import Purchases from 'react-native-purchases';
import purchasesService from '../../services/purchases';

describe('services/purchases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (purchasesService as any).initialized = false;
    (purchasesService as any).offerings = [];
  });

  it('initializes RevenueCat and fetches offerings', async () => {
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({ all: {} });
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({ entitlements: { active: {} } });

    await purchasesService.initialize('user-1');

    expect(Purchases.configure).toHaveBeenCalled();
    expect(Purchases.getOfferings).toHaveBeenCalled();
  });

  it('returns product-not-found when purchase target does not exist', async () => {
    const result = await purchasesService.purchaseProduct('unknown_product');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Product not found');
  });

  it('restores purchases successfully', async () => {
    (Purchases.restorePurchases as jest.Mock).mockResolvedValue({
      entitlements: { active: {} },
      managementURL: null,
    });

    const result = await purchasesService.restorePurchases();

    expect(Purchases.restorePurchases).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

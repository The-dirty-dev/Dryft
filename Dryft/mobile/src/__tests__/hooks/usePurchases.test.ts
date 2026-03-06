import * as purchaseHooks from '../../hooks/usePurchases';

describe('usePurchases hooks', () => {
  it('exports useSubscription', () => {
    expect(typeof purchaseHooks.useSubscription).toBe('function');
  });

  it('exports usePurchase', () => {
    expect(typeof purchaseHooks.usePurchase).toBe('function');
  });

  it('exports useManageSubscription', () => {
    expect(typeof purchaseHooks.useManageSubscription).toBe('function');
  });
});

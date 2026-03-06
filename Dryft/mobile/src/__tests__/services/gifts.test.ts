import giftService, { giftService as namedGiftService } from '../../services/gifts';

describe('services/gifts', () => {
  it('exports gift service singleton', () => {
    expect(giftService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(giftService).toBe(namedGiftService);
  });

  it('exposes gift APIs', () => {
    expect(typeof (giftService as any).getGiftCatalog).toBe('function');
    expect(typeof (giftService as any).sendGift).toBe('function');
  });
});

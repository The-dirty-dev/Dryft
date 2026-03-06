import cacheManager, { cacheManager as namedCacheManager } from '../../services/cacheManager';

describe('services/cacheManager', () => {
  it('exports cache manager singleton', () => {
    expect(cacheManager).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(cacheManager).toBe(namedCacheManager);
  });

  it('exposes set/get methods', () => {
    expect(typeof (cacheManager as any).set).toBe('function');
    expect(typeof (cacheManager as any).get).toBe('function');
  });
});

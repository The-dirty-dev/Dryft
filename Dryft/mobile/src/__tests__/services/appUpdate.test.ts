import appUpdateService, { appUpdateService as namedAppUpdateService } from '../../services/appUpdate';

describe('services/appUpdate', () => {
  it('exports app update singleton', () => {
    expect(appUpdateService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(appUpdateService).toBe(namedAppUpdateService);
  });

  it('exposes update-check API', () => {
    expect(typeof (appUpdateService as any).checkForUpdate).toBe('function');
  });
});

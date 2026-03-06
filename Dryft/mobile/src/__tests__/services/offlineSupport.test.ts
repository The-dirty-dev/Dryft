import offlineSupportService, { offlineSupportService as namedOfflineSupportService } from '../../services/offlineSupport';

describe('services/offlineSupport', () => {
  it('exports offline support singleton', () => {
    expect(offlineSupportService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(offlineSupportService).toBe(namedOfflineSupportService);
  });

  it('exposes queue/sync methods', () => {
    expect(typeof (offlineSupportService as any).queueAction).toBe('function');
    expect(typeof (offlineSupportService as any).syncQueue).toBe('function');
  });
});

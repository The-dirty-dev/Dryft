import voipPushService, { voipPushService as namedVoipPushService } from '../../services/voipPush';

describe('services/voipPush', () => {
  it('exports voip push singleton', () => {
    expect(voipPushService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(voipPushService).toBe(namedVoipPushService);
  });

  it('exposes initialize API', () => {
    expect(typeof (voipPushService as any).initialize).toBe('function');
  });
});

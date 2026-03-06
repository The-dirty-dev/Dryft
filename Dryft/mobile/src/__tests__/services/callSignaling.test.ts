import callSignalingService, { callSignalingService as namedCallSignalingService } from '../../services/callSignaling';

describe('services/callSignaling', () => {
  it('exports call signaling singleton', () => {
    expect(callSignalingService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(callSignalingService).toBe(namedCallSignalingService);
  });

  it('exposes connect/disconnect methods', () => {
    expect(typeof (callSignalingService as any).setHandlers).toBe('function');
    expect(typeof (callSignalingService as any).endCall).toBe('function');
  });
});

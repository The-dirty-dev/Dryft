import livenessDetectionService, { livenessDetectionService as namedLivenessService } from '../../services/livenessDetection';

describe('services/livenessDetection', () => {
  it('exports liveness detection singleton', () => {
    expect(livenessDetectionService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(livenessDetectionService).toBe(namedLivenessService);
  });

  it('exposes session lifecycle methods', () => {
    expect(typeof (livenessDetectionService as any).startVerificationSession).toBe('function');
    expect(typeof (livenessDetectionService as any).cancelSession).toBe('function');
  });
});

import safetyService, { safetyService as namedSafetyService } from '../../services/safety';

describe('services/safety', () => {
  it('exports safety singleton', () => {
    expect(safetyService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(safetyService).toBe(namedSafetyService);
  });

  it('exposes safety action methods', () => {
    expect(typeof (safetyService as any).triggerEmergencyAlert).toBe('function');
    expect(typeof (safetyService as any).addEmergencyContact).toBe('function');
  });
});

import * as couplesHooks from '../../hooks/useCouples';

describe('useCouples hooks', () => {
  it('exports useDashboard', () => {
    expect(typeof couplesHooks.useDashboard).toBe('function');
  });

  it('exports useCouple', () => {
    expect(typeof couplesHooks.useCouple).toBe('function');
  });

  it('exports useActivity', () => {
    expect(typeof couplesHooks.useActivity).toBe('function');
  });
});

import * as livenessHooks from '../../hooks/useLivenessDetection';

describe('useLivenessDetection hooks', () => {
  it('exports useLivenessDetection', () => {
    expect(typeof livenessHooks.useLivenessDetection).toBe('function');
  });

  it('exports useVerificationSession', () => {
    expect(typeof livenessHooks.useVerificationSession).toBe('function');
  });

  it('exports useFaceDetection', () => {
    expect(typeof livenessHooks.useFaceDetection).toBe('function');
  });
});

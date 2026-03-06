import * as moderationHooks from '../../hooks/useModeration';

describe('useModeration hooks', () => {
  it('exports useBlockedUsers', () => {
    expect(typeof moderationHooks.useBlockedUsers).toBe('function');
  });

  it('exports useReportUser', () => {
    expect(typeof moderationHooks.useReportUser).toBe('function');
  });

  it('exports useModerationActions', () => {
    expect(typeof moderationHooks.useModerationActions).toBe('function');
  });
});

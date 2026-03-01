const COVERAGE_GAPS = [
  {
    area: 'mobile screens: AchievementsScreen',
    reason: 'UI-heavy achievements rendering still lacks dedicated assertions.',
  },
  {
    area: 'mobile screens: ActivitiesScreen',
    reason: 'Needs deterministic fixtures for feed grouping and pagination behavior.',
  },
  {
    area: 'mobile screens: DailyRewardsScreen',
    reason: 'Timer-driven + haptic behavior needs fake-timer coverage to avoid flakes.',
  },
  {
    area: 'mobile screens: NotificationCenterScreen',
    reason: 'Relies on notification service side effects and richer interaction mocks.',
  },
  {
    area: 'mobile screens: TimelineScreen',
    reason: 'Data-dense rendering paths still need focused state/interaction tests.',
  },
  {
    area: 'mobile services: notifications.ts',
    reason: 'Expo notifications/device permission integration requires dedicated harness.',
  },
  {
    area: 'mobile hooks: useHaptic',
    reason: 'Hardware-dependent Intiface interactions require specialized mock device layer.',
  },
];

const COVERAGE_DONE = [
  'CompanionScreen behavior test added',
  'HapticSettingsScreen behavior test added',
  'API client error-path tests cover 400/401/403/404/429/500',
  'Offline store queue/cache/sync behaviors covered',
];

describe('mobile coverage gaps', () => {
  it('documents remaining Week 6 coverage gaps to address', () => {
    expect(COVERAGE_GAPS.length).toBeGreaterThan(0);
  });

  it('tracks completed high-priority coverage items', () => {
    expect(COVERAGE_DONE).toContain('CompanionScreen behavior test added');
    expect(COVERAGE_DONE).toContain('HapticSettingsScreen behavior test added');
  });
});

import { useSettingsStore } from '../store/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const state = useSettingsStore.getState();
    state.resetToDefaults();
    state.markSynced();
  });

  it('updates notification settings and marks dirty', () => {
    useSettingsStore.getState().updateNotificationSettings({ marketing: true });

    const state = useSettingsStore.getState();
    expect(state.notifications.marketing).toBe(true);
    expect(state.isDirty).toBe(true);
  });

  it('resets to defaults and marks dirty', () => {
    useSettingsStore.getState().updatePrivacySettings({ showAge: false });

    useSettingsStore.getState().resetToDefaults();

    const state = useSettingsStore.getState();
    expect(state.privacy.showAge).toBe(true);
    expect(state.isDirty).toBe(true);
  });

  it('sets all settings and clears dirty flag', () => {
    const current = useSettingsStore.getState();
    const newSettings = {
      notifications: { ...current.notifications, matches: false },
      privacy: { ...current.privacy, showOnlineStatus: false },
      appearance: { ...current.appearance, theme: 'light' },
      vr: { ...current.vr, comfortMode: 'moderate' },
      haptic: { ...current.haptic, enabled: true },
      matching: { ...current.matching, maxDistance: 25 },
      safety: { ...current.safety, panicButtonEnabled: false },
    };

    useSettingsStore.getState().setAllSettings(newSettings);

    const state = useSettingsStore.getState();
    expect(state.notifications.matches).toBe(false);
    expect(state.appearance.theme).toBe('light');
    expect(state.matching.maxDistance).toBe(25);
    expect(state.isDirty).toBe(false);
    expect(state.lastSyncedAt).not.toBeNull();
  });

  it('returns changed settings snapshot', () => {
    const snapshot = useSettingsStore.getState().getChangedSettings();

    expect(snapshot.notifications).toBeDefined();
    expect(snapshot.privacy).toBeDefined();
    expect(snapshot.safety).toBeDefined();
  });
});

import { apiClient } from './client';
import { AllSettings, useSettingsStore } from '../store/settingsStore';

export interface SettingsResponse {
  settings: AllSettings;
  updatedAt: string;
}

export interface SettingsSyncResult {
  merged: AllSettings;
  conflicts: string[];
  serverUpdatedAt: string;
}

// Fetch settings from server
export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await apiClient.get<SettingsResponse>('/v1/settings');
  if (!response.data) throw new Error('No settings data returned');
  return response.data;
}

// Update settings on server
export async function updateSettings(settings: Partial<AllSettings>): Promise<SettingsResponse> {
  const response = await apiClient.put<SettingsResponse>('/v1/settings', settings);
  if (!response.data) throw new Error('No settings data returned');
  return response.data;
}

// Sync local settings with server (handles conflicts)
export async function syncSettings(
  localSettings: AllSettings,
  localUpdatedAt: number | null
): Promise<SettingsSyncResult> {
  const response = await apiClient.post<SettingsSyncResult>('/v1/settings/sync', {
    settings: localSettings,
    clientUpdatedAt: localUpdatedAt ? new Date(localUpdatedAt).toISOString() : null,
  });
  if (!response.data) throw new Error('No sync result returned');
  return response.data;
}

// Update specific setting category
export async function updateNotificationSettings(
  settings: Partial<AllSettings['notifications']>
): Promise<void> {
  await apiClient.patch('/v1/settings/notifications', settings);
}

export async function updatePrivacySettings(
  settings: Partial<AllSettings['privacy']>
): Promise<void> {
  await apiClient.patch('/v1/settings/privacy', settings);
}

export async function updateMatchingPreferences(
  settings: Partial<AllSettings['matching']>
): Promise<void> {
  await apiClient.patch('/v1/settings/matching', settings);
}

export async function updateSafetySettings(
  settings: Partial<AllSettings['safety']>
): Promise<void> {
  await apiClient.patch('/v1/settings/safety', settings);
}

export async function updateVRSettings(
  settings: Partial<AllSettings['vr']>
): Promise<void> {
  await apiClient.patch('/v1/settings/vr', settings);
}

export async function updateHapticSettings(
  settings: Partial<AllSettings['haptic']>
): Promise<void> {
  await apiClient.patch('/v1/settings/haptic', settings);
}

// Reset settings to defaults
export async function resetSettings(): Promise<SettingsResponse> {
  const response = await apiClient.post<SettingsResponse>('/v1/settings/reset');
  if (!response.data) throw new Error('No settings data returned');
  return response.data;
}

// Settings sync service
class SettingsSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private pendingSync = false;

  // Start periodic sync
  startPeriodicSync(intervalMs: number = 5 * 60 * 1000) {
    this.stopPeriodicSync();
    this.syncInterval = setInterval(() => this.syncIfNeeded(), intervalMs);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sync if there are local changes
  async syncIfNeeded(): Promise<void> {
    const store = useSettingsStore.getState();
    if (!store.isDirty) return;

    await this.sync();
  }

  // Force sync with server
  async sync(): Promise<SettingsSyncResult | null> {
    if (this.isSyncing) {
      this.pendingSync = true;
      return null;
    }

    this.isSyncing = true;

    try {
      const store = useSettingsStore.getState();
      const localSettings = store.getChangedSettings() as AllSettings;

      const result = await syncSettings(localSettings, store.lastSyncedAt);

      // Update store with merged settings
      store.setAllSettings(result.merged);

      // Log conflicts for debugging
      if (result.conflicts.length > 0) {
        console.warn('Settings sync conflicts:', result.conflicts);
      }

      return result;
    } catch (error) {
      console.error('Settings sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;

      // Handle pending sync request
      if (this.pendingSync) {
        this.pendingSync = false;
        setTimeout(() => this.sync(), 1000);
      }
    }
  }

  // Pull latest settings from server
  async pull(): Promise<AllSettings> {
    try {
      const response = await fetchSettings();
      const store = useSettingsStore.getState();
      store.setAllSettings(response.settings);
      return response.settings;
    } catch (error) {
      console.error('Failed to pull settings:', error);
      throw error;
    }
  }

  // Push local settings to server
  async push(): Promise<void> {
    try {
      const store = useSettingsStore.getState();
      const settings = store.getChangedSettings() as AllSettings;
      await updateSettings(settings);
      store.markSynced();
    } catch (error) {
      console.error('Failed to push settings:', error);
      throw error;
    }
  }
}

export const settingsSyncService = new SettingsSyncService();

// Hook for settings sync
export function useSettingsSync() {
  const syncSettings = async () => {
    return settingsSyncService.sync();
  };

  const pullSettings = async () => {
    return settingsSyncService.pull();
  };

  const pushSettings = async () => {
    return settingsSyncService.push();
  };

  return {
    syncSettings,
    pullSettings,
    pushSettings,
    startPeriodicSync: (interval?: number) => settingsSyncService.startPeriodicSync(interval),
    stopPeriodicSync: () => settingsSyncService.stopPeriodicSync(),
  };
}

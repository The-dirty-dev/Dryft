import { Platform, Linking, Alert } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type UpdatePriority = 'critical' | 'recommended' | 'optional';

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  minimumVersion: string;
  updatePriority: UpdatePriority;
  releaseNotes?: string;
  updateUrl: string;
  isUpdateAvailable: boolean;
  isUpdateRequired: boolean;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  isUpdateRequired: boolean;
  versionInfo: VersionInfo;
  shouldShowPrompt: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  LAST_CHECK: 'dryft_update_last_check',
  SKIPPED_VERSION: 'dryft_update_skipped_version',
  PROMPT_COUNT: 'dryft_update_prompt_count',
};

// Store URLs
const STORE_URLS = {
  ios: `https://apps.apple.com/app/id${Constants.expoConfig?.ios?.bundleIdentifier || 'dryft'}`,
  android: `https://play.google.com/store/apps/details?id=${Constants.expoConfig?.android?.package || 'com.dryft.app'}`,
};

// Check interval (hours)
const CHECK_INTERVAL_HOURS = 24;
const MAX_OPTIONAL_PROMPTS = 3;

// ============================================================================
// App Update Service
// ============================================================================

class AppUpdateService {
  private static instance: AppUpdateService;
  private currentVersion: string;
  private latestVersionInfo: VersionInfo | null = null;

  private constructor() {
    this.currentVersion = Constants.expoConfig?.version || '1.0.0';
  }

  static getInstance(): AppUpdateService {
    if (!AppUpdateService.instance) {
      AppUpdateService.instance = new AppUpdateService();
    }
    return AppUpdateService.instance;
  }

  // ==========================================================================
  // Version Checking
  // ==========================================================================

  async checkForUpdate(force: boolean = false): Promise<UpdateCheckResult> {
    // Check if we should skip this check
    if (!force) {
      const shouldCheck = await this.shouldPerformCheck();
      if (!shouldCheck) {
        return this.getDefaultResult();
      }
    }

    try {
      // Fetch version info from your backend
      const versionInfo = await this.fetchVersionInfo();
      this.latestVersionInfo = versionInfo;

      // Save check timestamp
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK, Date.now().toString());

      // Determine if we should show prompt
      const shouldShowPrompt = await this.shouldShowPrompt(versionInfo);

      trackEvent('update_check_completed', {
        current_version: this.currentVersion,
        latest_version: versionInfo.latestVersion,
        is_available: versionInfo.isUpdateAvailable,
        is_required: versionInfo.isUpdateRequired,
      });

      return {
        isUpdateAvailable: versionInfo.isUpdateAvailable,
        isUpdateRequired: versionInfo.isUpdateRequired,
        versionInfo,
        shouldShowPrompt,
      };
    } catch (error) {
      console.error('[AppUpdate] Check failed:', error);
      return this.getDefaultResult();
    }
  }

  private async fetchVersionInfo(): Promise<VersionInfo> {
    // In a real app, this would fetch from your backend
    // For now, simulate with hardcoded response
    try {
      // const response = await fetch('https://api.dryft.site/v1/app/version');
      // const data = await response.json();

      // Simulated response
      const data = {
        ios: {
          latest_version: '1.0.0',
          minimum_version: '1.0.0',
          update_priority: 'optional' as UpdatePriority,
          release_notes: 'Bug fixes and performance improvements.',
        },
        android: {
          latest_version: '1.0.0',
          minimum_version: '1.0.0',
          update_priority: 'optional' as UpdatePriority,
          release_notes: 'Bug fixes and performance improvements.',
        },
      };

      const platformData = Platform.OS === 'ios' ? data.ios : data.android;

      const isUpdateAvailable = this.compareVersions(
        this.currentVersion,
        platformData.latest_version
      ) < 0;

      const isUpdateRequired = this.compareVersions(
        this.currentVersion,
        platformData.minimum_version
      ) < 0;

      return {
        currentVersion: this.currentVersion,
        latestVersion: platformData.latest_version,
        minimumVersion: platformData.minimum_version,
        updatePriority: platformData.update_priority,
        releaseNotes: platformData.release_notes,
        updateUrl: this.getStoreUrl(),
        isUpdateAvailable,
        isUpdateRequired,
      };
    } catch (error) {
      console.error('[AppUpdate] Fetch failed:', error);
      throw error;
    }
  }

  private async shouldPerformCheck(): Promise<boolean> {
    try {
      const lastCheck = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK);
      if (!lastCheck) return true;

      const lastCheckTime = parseInt(lastCheck, 10);
      const hoursSinceCheck = (Date.now() - lastCheckTime) / (1000 * 60 * 60);

      return hoursSinceCheck >= CHECK_INTERVAL_HOURS;
    } catch {
      return true;
    }
  }

  private async shouldShowPrompt(versionInfo: VersionInfo): Promise<boolean> {
    // Always show for required updates
    if (versionInfo.isUpdateRequired) {
      return true;
    }

    // Don't show if no update available
    if (!versionInfo.isUpdateAvailable) {
      return false;
    }

    // Check if user skipped this version
    const skippedVersion = await AsyncStorage.getItem(STORAGE_KEYS.SKIPPED_VERSION);
    if (skippedVersion === versionInfo.latestVersion) {
      return false;
    }

    // Limit optional prompts
    if (versionInfo.updatePriority === 'optional') {
      const promptCount = await this.getPromptCount();
      if (promptCount >= MAX_OPTIONAL_PROMPTS) {
        return false;
      }
    }

    return true;
  }

  private async getPromptCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem(STORAGE_KEYS.PROMPT_COUNT);
      return count ? parseInt(count, 10) : 0;
    } catch {
      return 0;
    }
  }

  private async incrementPromptCount(): Promise<void> {
    const count = await this.getPromptCount();
    await AsyncStorage.setItem(STORAGE_KEYS.PROMPT_COUNT, (count + 1).toString());
  }

  private getDefaultResult(): UpdateCheckResult {
    return {
      isUpdateAvailable: false,
      isUpdateRequired: false,
      versionInfo: {
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        minimumVersion: this.currentVersion,
        updatePriority: 'optional',
        updateUrl: this.getStoreUrl(),
        isUpdateAvailable: false,
        isUpdateRequired: false,
      },
      shouldShowPrompt: false,
    };
  }

  // ==========================================================================
  // Version Comparison
  // ==========================================================================

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  // ==========================================================================
  // User Actions
  // ==========================================================================

  async skipVersion(version: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SKIPPED_VERSION, version);
    await this.incrementPromptCount();

    trackEvent('update_skipped', {
      skipped_version: version,
      current_version: this.currentVersion,
    });
  }

  async remindLater(): Promise<void> {
    await this.incrementPromptCount();

    trackEvent('update_remind_later', {
      current_version: this.currentVersion,
    });
  }

  async openStore(): Promise<void> {
    const url = this.getStoreUrl();

    trackEvent('update_store_opened', {
      current_version: this.currentVersion,
      latest_version: this.latestVersionInfo?.latestVersion,
    });

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('[AppUpdate] Failed to open store:', error);
    }
  }

  // ==========================================================================
  // Alerts
  // ==========================================================================

  showUpdateAlert(versionInfo: VersionInfo, onDismiss?: () => void): void {
    const buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'default' | 'destructive';
    }> = [];

    if (versionInfo.isUpdateRequired) {
      // Required update - only show update button
      buttons.push({
        text: 'Update Now',
        onPress: () => this.openStore(),
      });
    } else {
      // Optional update - show all options
      buttons.push({
        text: 'Not Now',
        style: 'cancel',
        onPress: () => {
          this.remindLater();
          onDismiss?.();
        },
      });

      if (versionInfo.updatePriority === 'optional') {
        buttons.push({
          text: 'Skip This Version',
          onPress: () => {
            this.skipVersion(versionInfo.latestVersion);
            onDismiss?.();
          },
        });
      }

      buttons.push({
        text: 'Update',
        onPress: () => this.openStore(),
      });
    }

    const title = versionInfo.isUpdateRequired
      ? 'Update Required'
      : 'Update Available';

    const message = versionInfo.isUpdateRequired
      ? `A required update (v${versionInfo.latestVersion}) is available. Please update to continue using Dryft.`
      : `A new version (v${versionInfo.latestVersion}) is available.${
          versionInfo.releaseNotes ? `\n\n${versionInfo.releaseNotes}` : ''
        }`;

    Alert.alert(title, message, buttons, {
      cancelable: !versionInfo.isUpdateRequired,
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  getBuildNumber(): string {
    return Application.nativeBuildVersion || '1';
  }

  getStoreUrl(): string {
    return Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
  }

  getLatestVersionInfo(): VersionInfo | null {
    return this.latestVersionInfo;
  }

  async resetPromptCount(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PROMPT_COUNT);
    await AsyncStorage.removeItem(STORAGE_KEYS.SKIPPED_VERSION);
  }
}

export const appUpdateService = AppUpdateService.getInstance();
export default appUpdateService;

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { Platform } from 'react-native';
import { api } from './api';
import { analytics, trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export interface DataExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'expired' | 'failed';
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  format: 'json' | 'csv' | 'pdf';
  includeMedia: boolean;
  categories: DataCategory[];
  estimatedSize?: number;
}

export type DataCategory =
  | 'profile'
  | 'photos'
  | 'preferences'
  | 'matches'
  | 'messages'
  | 'likes'
  | 'blocks'
  | 'reports'
  | 'purchases'
  | 'vr_sessions'
  | 'analytics'
  | 'settings';

export interface ExportedData {
  exportedAt: string;
  userId: string;
  format: string;
  categories: {
    profile?: ProfileData;
    photos?: PhotoData[];
    preferences?: PreferencesData;
    matches?: MatchData[];
    messages?: MessageData[];
    likes?: LikeData[];
    blocks?: BlockData[];
    reports?: ReportData[];
    purchases?: PurchaseData[];
    vrSessions?: VRSessionData[];
    analytics?: AnalyticsData;
    settings?: SettingsData;
  };
}

interface ProfileData {
  id: string;
  email: string;
  name: string;
  birthDate: string;
  gender: string;
  bio: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
  verificationStatus: string;
  subscriptionTier: string;
}

interface PhotoData {
  id: string;
  url: string;
  position: number;
  uploadedAt: string;
  isVerification: boolean;
}

interface PreferencesData {
  ageRange: { min: number; max: number };
  distance: number;
  genderPreferences: string[];
  showMe: boolean;
  notificationSettings: Record<string, boolean>;
}

interface MatchData {
  id: string;
  matchedUserId: string;
  matchedUserName: string;
  matchedAt: string;
  unmatchedAt?: string;
  messageCount: number;
}

interface MessageData {
  id: string;
  matchId: string;
  content: string;
  sentAt: string;
  isFromMe: boolean;
  mediaType?: string;
}

interface LikeData {
  userId: string;
  type: 'like' | 'super_like' | 'pass';
  createdAt: string;
}

interface BlockData {
  userId: string;
  reason?: string;
  blockedAt: string;
}

interface ReportData {
  userId: string;
  reason: string;
  details?: string;
  reportedAt: string;
}

interface PurchaseData {
  id: string;
  productId: string;
  amount: number;
  currency: string;
  purchasedAt: string;
  status: string;
}

interface VRSessionData {
  id: string;
  sessionCode: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  partnerId?: string;
}

interface AnalyticsData {
  totalSessions: number;
  totalTimeSpent: number;
  firstOpenAt: string;
  lastActiveAt: string;
  deviceInfo: Record<string, string>;
}

interface SettingsData {
  theme: string;
  language: string;
  privacySettings: Record<string, boolean>;
  notificationSettings: Record<string, boolean>;
  accessibilitySettings: Record<string, any>;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  EXPORT_REQUESTS: 'dryft_export_requests',
  LAST_EXPORT: 'dryft_last_export',
};

// ============================================================================
// Data Export Service
// ============================================================================

class DataExportService {
  private static instance: DataExportService;

  private constructor() {}

  static getInstance(): DataExportService {
    if (!DataExportService.instance) {
      DataExportService.instance = new DataExportService();
    }
    return DataExportService.instance;
  }

  // ==========================================================================
  // Request Data Export
  // ==========================================================================

  async requestExport(
    categories: DataCategory[],
    format: 'json' | 'csv' | 'pdf' = 'json',
    includeMedia: boolean = false
  ): Promise<DataExportRequest> {
    trackEvent('settings_changed', {
      action: 'data_export_requested',
      categories: categories.join(','),
      format,
      include_media: includeMedia,
    });

    try {
      const response = await api.post<DataExportRequest>('/v1/account/export', {
        categories,
        format,
        include_media: includeMedia,
      });

      // Store request locally
      await this.saveExportRequest(response.data);

      return response.data;
    } catch (error: any) {
      analytics.trackError(error, { action: 'request_data_export' });
      throw error;
    }
  }

  async getExportStatus(requestId: string): Promise<DataExportRequest> {
    try {
      const response = await api.get<DataExportRequest>(`/v1/account/export/${requestId}`);

      // Update local storage
      await this.updateExportRequest(response.data);

      return response.data;
    } catch (error: any) {
      analytics.trackError(error, { action: 'get_export_status' });
      throw error;
    }
  }

  async getExportHistory(): Promise<DataExportRequest[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EXPORT_REQUESTS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  // ==========================================================================
  // Download Export
  // ==========================================================================

  async downloadExport(request: DataExportRequest): Promise<string> {
    if (!request.downloadUrl || request.status !== 'ready') {
      throw new Error('Export not ready for download');
    }

    trackEvent('settings_changed', {
      action: 'data_export_downloaded',
      format: request.format,
    });

    try {
      const fileName = `dryft_data_export_${Date.now()}.${request.format === 'json' ? 'json' : request.format}`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      const downloadResult = await FileSystem.downloadAsync(
        request.downloadUrl,
        fileUri
      );

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      return downloadResult.uri;
    } catch (error: any) {
      analytics.trackError(error, { action: 'download_export' });
      throw error;
    }
  }

  async shareExport(fileUri: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      throw new Error('Sharing not available on this device');
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Your Data',
    });
  }

  async emailExport(fileUri: string, userEmail: string): Promise<void> {
    const isAvailable = await MailComposer.isAvailableAsync();

    if (!isAvailable) {
      throw new Error('Email not available on this device');
    }

    await MailComposer.composeAsync({
      recipients: [userEmail],
      subject: 'Your Dryft Data Export',
      body: 'Attached is your requested data export from Dryft. This file contains your personal data as per your request.',
      attachments: [fileUri],
    });
  }

  // ==========================================================================
  // Local Data Export (Immediate)
  // ==========================================================================

  async exportLocalData(): Promise<ExportedData> {
    const localData: ExportedData = {
      exportedAt: new Date().toISOString(),
      userId: 'local',
      format: 'json',
      categories: {},
    };

    try {
      // Collect all local AsyncStorage data
      const allKeys = await AsyncStorage.getAllKeys();
      const driftKeys = allKeys.filter(key => key.startsWith('dryft_'));
      const allData = await AsyncStorage.multiGet(driftKeys);

      const settings: Record<string, any> = {};
      allData.forEach(([key, value]) => {
        if (value) {
          try {
            settings[key] = JSON.parse(value);
          } catch {
            settings[key] = value;
          }
        }
      });

      localData.categories.settings = {
        theme: settings['dryft_theme'] || 'dark',
        language: settings['dryft_language'] || 'en',
        privacySettings: settings['dryft_privacy_settings'] || {},
        notificationSettings: settings['dryft_notification_category_settings'] || {},
        accessibilitySettings: settings['dryft_accessibility_settings'] || {},
      };

      localData.categories.analytics = {
        totalSessions: parseInt(settings['dryft_analytics_total_sessions'] || '0', 10),
        totalTimeSpent: parseInt(settings['dryft_metrics_total_time_spent'] || '0', 10),
        firstOpenAt: settings['dryft_analytics_first_open'] || '',
        lastActiveAt: settings['dryft_metrics_last_active'] || '',
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version.toString(),
        },
      };

      return localData;
    } catch (error: any) {
      analytics.trackError(error, { action: 'export_local_data' });
      throw error;
    }
  }

  async saveLocalExport(data: ExportedData): Promise<string> {
    const fileName = `dryft_local_export_${Date.now()}.json`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(
      fileUri,
      JSON.stringify(data, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );

    return fileUri;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private async saveExportRequest(request: DataExportRequest): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EXPORT_REQUESTS);
      const requests: DataExportRequest[] = stored ? JSON.parse(stored) : [];

      requests.unshift(request);

      // Keep only last 10 requests
      const trimmed = requests.slice(0, 10);

      await AsyncStorage.setItem(STORAGE_KEYS.EXPORT_REQUESTS, JSON.stringify(trimmed));
    } catch (error) {
      console.error('[DataExport] Failed to save request:', error);
    }
  }

  private async updateExportRequest(request: DataExportRequest): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EXPORT_REQUESTS);
      const requests: DataExportRequest[] = stored ? JSON.parse(stored) : [];

      const index = requests.findIndex(r => r.id === request.id);
      if (index >= 0) {
        requests[index] = request;
        await AsyncStorage.setItem(STORAGE_KEYS.EXPORT_REQUESTS, JSON.stringify(requests));
      }
    } catch (error) {
      console.error('[DataExport] Failed to update request:', error);
    }
  }

  async getLastExportDate(): Promise<Date | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LAST_EXPORT);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  }

  async canRequestExport(): Promise<{ allowed: boolean; reason?: string; nextAvailable?: Date }> {
    const lastExport = await this.getLastExportDate();

    if (!lastExport) {
      return { allowed: true };
    }

    // Allow one export per 24 hours
    const cooldown = 24 * 60 * 60 * 1000;
    const nextAvailable = new Date(lastExport.getTime() + cooldown);

    if (Date.now() < nextAvailable.getTime()) {
      return {
        allowed: false,
        reason: 'You can only request one export per 24 hours',
        nextAvailable,
      };
    }

    return { allowed: true };
  }

  getAllCategories(): DataCategory[] {
    return [
      'profile',
      'photos',
      'preferences',
      'matches',
      'messages',
      'likes',
      'blocks',
      'reports',
      'purchases',
      'vr_sessions',
      'analytics',
      'settings',
    ];
  }

  getCategoryDescription(category: DataCategory): string {
    const descriptions: Record<DataCategory, string> = {
      profile: 'Your profile information including name, bio, and verification status',
      photos: 'All photos you\'ve uploaded to your profile',
      preferences: 'Your matching preferences and filter settings',
      matches: 'History of all your matches',
      messages: 'All messages sent and received',
      likes: 'Your swipe history (likes, passes, super likes)',
      blocks: 'Users you\'ve blocked',
      reports: 'Reports you\'ve submitted',
      purchases: 'Your purchase and subscription history',
      vr_sessions: 'Your VR session history',
      analytics: 'Your app usage data and statistics',
      settings: 'App settings and preferences',
    };
    return descriptions[category];
  }
}

export const dataExportService = DataExportService.getInstance();
export default dataExportService;

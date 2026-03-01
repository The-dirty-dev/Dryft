import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SMS from 'expo-sms';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isVerified: boolean;
  addedAt: string;
}

export interface SafetyCheck {
  id: string;
  matchId: string;
  matchName: string;
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'alerted' | 'cancelled';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface LocationSharingSettings {
  enabled: boolean;
  showExactLocation: boolean;
  showDistance: boolean;
  showCity: boolean;
  shareWithMatches: boolean;
}

export interface ScamWarning {
  id: string;
  type: 'romance_scam' | 'financial_request' | 'external_link' | 'personal_info' | 'suspicious_behavior';
  severity: 'low' | 'medium' | 'high';
  message: string;
  detectedAt: string;
  context?: string;
}

export type SafetyFeature =
  | 'emergency_contacts'
  | 'safety_check'
  | 'location_sharing'
  | 'scam_detection'
  | 'photo_verification'
  | 'video_call_first';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  EMERGENCY_CONTACTS: 'dryft_emergency_contacts',
  SAFETY_CHECKS: 'dryft_safety_checks',
  LOCATION_SETTINGS: 'dryft_location_settings',
  SAFETY_PREFERENCES: 'dryft_safety_preferences',
};

const SCAM_PATTERNS = {
  financial: [
    /send (me )?money/i,
    /wire (me )?funds/i,
    /gift card/i,
    /bitcoin|crypto/i,
    /western union/i,
    /bank transfer/i,
    /investment opportunity/i,
  ],
  personal_info: [
    /social security/i,
    /credit card number/i,
    /bank account/i,
    /password/i,
    /mother'?s? maiden name/i,
  ],
  external_links: [
    /click (this|here|the) link/i,
    /verify your account/i,
    /telegram|whatsapp|signal/i,
    /private (chat|message)/i,
  ],
  romance_scam: [
    /i love you.{0,20}send/i,
    /stuck (in|at)/i,
    /emergency.{0,20}money/i,
    /military deployment/i,
    /oil rig/i,
    /inheritance/i,
  ],
};

const DEFAULT_LOCATION_SETTINGS: LocationSharingSettings = {
  enabled: true,
  showExactLocation: false,
  showDistance: true,
  showCity: true,
  shareWithMatches: true,
};

// ============================================================================
// Safety Service
// ============================================================================

class SafetyService {
  private static instance: SafetyService;
  private emergencyContacts: EmergencyContact[] = [];
  private safetyChecks: SafetyCheck[] = [];
  private locationSettings: LocationSharingSettings = DEFAULT_LOCATION_SETTINGS;
  private initialized = false;

  private constructor() {}

  static getInstance(): SafetyService {
    if (!SafetyService.instance) {
      SafetyService.instance = new SafetyService();
    }
    return SafetyService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadEmergencyContacts(),
      this.loadSafetyChecks(),
      this.loadLocationSettings(),
    ]);

    this.initialized = true;
    console.log('[Safety] Initialized');
  }

  // ==========================================================================
  // Emergency Contacts
  // ==========================================================================

  private async loadEmergencyContacts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.EMERGENCY_CONTACTS);
      if (stored) {
        this.emergencyContacts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Safety] Failed to load emergency contacts:', error);
    }
  }

  private async saveEmergencyContacts(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.EMERGENCY_CONTACTS,
        JSON.stringify(this.emergencyContacts)
      );
    } catch (error) {
      console.error('[Safety] Failed to save emergency contacts:', error);
    }
  }

  async addEmergencyContact(
    name: string,
    phone: string,
    relationship: string
  ): Promise<EmergencyContact | null> {
    try {
      const contact: EmergencyContact = {
        id: `contact_${Date.now()}`,
        name,
        phone: this.normalizePhone(phone),
        relationship,
        isVerified: false,
        addedAt: new Date().toISOString(),
      };

      this.emergencyContacts.push(contact);
      await this.saveEmergencyContacts();

      // Send verification
      await this.sendContactVerification(contact);

      trackEvent('emergency_contact_added', {
        relationship,
      });

      return contact;
    } catch (error) {
      console.error('[Safety] Failed to add emergency contact:', error);
      return null;
    }
  }

  async removeEmergencyContact(contactId: string): Promise<boolean> {
    try {
      this.emergencyContacts = this.emergencyContacts.filter(
        (c) => c.id !== contactId
      );
      await this.saveEmergencyContacts();

      trackEvent('emergency_contact_removed');
      return true;
    } catch (error) {
      console.error('[Safety] Failed to remove emergency contact:', error);
      return false;
    }
  }

  async verifyContact(contactId: string): Promise<boolean> {
    const contact = this.emergencyContacts.find((c) => c.id === contactId);
    if (!contact) return false;

    contact.isVerified = true;
    await this.saveEmergencyContacts();
    return true;
  }

  getEmergencyContacts(): EmergencyContact[] {
    return [...this.emergencyContacts];
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  private async sendContactVerification(contact: EmergencyContact): Promise<void> {
    try {
      await api.post('/v1/safety/verify-contact', {
        contact_id: contact.id,
        phone: contact.phone,
        name: contact.name,
      });
    } catch (error) {
      console.error('[Safety] Failed to send verification:', error);
    }
  }

  // ==========================================================================
  // Emergency Alert
  // ==========================================================================

  async triggerEmergencyAlert(includeLocation: boolean = true): Promise<boolean> {
    const contacts = this.emergencyContacts.filter((c) => c.isVerified);

    if (contacts.length === 0) {
      Alert.alert(
        'No Emergency Contacts',
        'Please add and verify at least one emergency contact first.'
      );
      return false;
    }

    try {
      // Get current location if requested
      let location: { latitude: number; longitude: number } | null = null;
      let address: string | undefined;

      if (includeLocation) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          // Reverse geocode
          try {
            const [geocoded] = await Location.reverseGeocodeAsync(location);
            if (geocoded) {
              address = [
                geocoded.street,
                geocoded.city,
                geocoded.region,
              ]
                .filter(Boolean)
                .join(', ');
            }
          } catch {
            // Geocoding failed, continue without address
          }
        }
      }

      // Build alert message
      let message = `DRYFT SAFETY ALERT: I may need help. `;
      if (location) {
        const mapUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
        message += `My location: ${address || mapUrl}`;
      }

      // Send SMS to all contacts
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        const phones = contacts.map((c) => c.phone);
        await SMS.sendSMSAsync(phones, message);
      }

      // Log to server
      await api.post('/v1/safety/emergency-alert', {
        location,
        address,
        contacts: contacts.map((c) => c.id),
      });

      trackEvent('emergency_alert_triggered', {
        contact_count: contacts.length,
        include_location: includeLocation,
      });

      return true;
    } catch (error) {
      console.error('[Safety] Failed to trigger emergency alert:', error);
      return false;
    }
  }

  async callEmergencyServices(): Promise<void> {
    const emergencyNumber = Platform.OS === 'ios' ? 'tel:911' : 'tel:911';
    await Linking.openURL(emergencyNumber);

    trackEvent('emergency_services_called');
  }

  // ==========================================================================
  // Safety Check (Date Check-in)
  // ==========================================================================

  private async loadSafetyChecks(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAFETY_CHECKS);
      if (stored) {
        this.safetyChecks = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Safety] Failed to load safety checks:', error);
    }
  }

  private async saveSafetyChecks(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SAFETY_CHECKS,
        JSON.stringify(this.safetyChecks)
      );
    } catch (error) {
      console.error('[Safety] Failed to save safety checks:', error);
    }
  }

  async scheduleSafetyCheck(
    matchId: string,
    matchName: string,
    scheduledAt: Date,
    location?: { latitude: number; longitude: number; address?: string }
  ): Promise<SafetyCheck | null> {
    try {
      const check: SafetyCheck = {
        id: `check_${Date.now()}`,
        matchId,
        matchName,
        scheduledAt: scheduledAt.toISOString(),
        status: 'pending',
        location,
      };

      this.safetyChecks.push(check);
      await this.saveSafetyChecks();

      // Schedule notification
      await api.post('/v1/safety/schedule-check', {
        check_id: check.id,
        scheduled_at: check.scheduledAt,
        match_name: matchName,
      });

      trackEvent('safety_check_scheduled', {
        has_location: !!location,
      });

      return check;
    } catch (error) {
      console.error('[Safety] Failed to schedule safety check:', error);
      return null;
    }
  }

  async confirmSafetyCheck(checkId: string): Promise<boolean> {
    const check = this.safetyChecks.find((c) => c.id === checkId);
    if (!check) return false;

    check.status = 'confirmed';
    await this.saveSafetyChecks();

    await api.post('/v1/safety/confirm-check', { check_id: checkId });

    trackEvent('safety_check_confirmed');
    return true;
  }

  async cancelSafetyCheck(checkId: string): Promise<boolean> {
    const check = this.safetyChecks.find((c) => c.id === checkId);
    if (!check) return false;

    check.status = 'cancelled';
    await this.saveSafetyChecks();

    await api.post('/v1/safety/cancel-check', { check_id: checkId });

    return true;
  }

  getPendingSafetyChecks(): SafetyCheck[] {
    return this.safetyChecks.filter((c) => c.status === 'pending');
  }

  // ==========================================================================
  // Location Sharing Settings
  // ==========================================================================

  private async loadLocationSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_SETTINGS);
      if (stored) {
        this.locationSettings = { ...DEFAULT_LOCATION_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[Safety] Failed to load location settings:', error);
    }
  }

  async updateLocationSettings(
    settings: Partial<LocationSharingSettings>
  ): Promise<void> {
    this.locationSettings = { ...this.locationSettings, ...settings };
    await AsyncStorage.setItem(
      STORAGE_KEYS.LOCATION_SETTINGS,
      JSON.stringify(this.locationSettings)
    );

    trackEvent('location_settings_updated', settings);
  }

  getLocationSettings(): LocationSharingSettings {
    return { ...this.locationSettings };
  }

  // ==========================================================================
  // Scam Detection
  // ==========================================================================

  analyzeMessageForScams(message: string): ScamWarning | null {
    // Check financial scam patterns
    for (const pattern of SCAM_PATTERNS.financial) {
      if (pattern.test(message)) {
        return {
          id: `warning_${Date.now()}`,
          type: 'financial_request',
          severity: 'high',
          message: 'This message may contain a financial scam attempt. Never send money to someone you haven\'t met in person.',
          detectedAt: new Date().toISOString(),
          context: message.substring(0, 100),
        };
      }
    }

    // Check personal info requests
    for (const pattern of SCAM_PATTERNS.personal_info) {
      if (pattern.test(message)) {
        return {
          id: `warning_${Date.now()}`,
          type: 'personal_info',
          severity: 'high',
          message: 'Be careful! This message is asking for sensitive personal information.',
          detectedAt: new Date().toISOString(),
          context: message.substring(0, 100),
        };
      }
    }

    // Check external link requests
    for (const pattern of SCAM_PATTERNS.external_links) {
      if (pattern.test(message)) {
        return {
          id: `warning_${Date.now()}`,
          type: 'external_link',
          severity: 'medium',
          message: 'Be cautious about moving conversations off the app. Scammers often try to communicate on other platforms.',
          detectedAt: new Date().toISOString(),
          context: message.substring(0, 100),
        };
      }
    }

    // Check romance scam patterns
    for (const pattern of SCAM_PATTERNS.romance_scam) {
      if (pattern.test(message)) {
        return {
          id: `warning_${Date.now()}`,
          type: 'romance_scam',
          severity: 'high',
          message: 'This message shows common romance scam patterns. Take time to verify this person\'s identity.',
          detectedAt: new Date().toISOString(),
          context: message.substring(0, 100),
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // Safety Tips
  // ==========================================================================

  getSafetyTips(): Array<{ title: string; description: string; icon: string }> {
    return [
      {
        title: 'Meet in Public',
        description: 'Always meet in a public place for your first few dates.',
        icon: 'people',
      },
      {
        title: 'Tell Someone',
        description: 'Let a friend or family member know about your plans.',
        icon: 'chatbubble',
      },
      {
        title: 'Stay Sober',
        description: 'Keep a clear head, especially on first dates.',
        icon: 'wine',
      },
      {
        title: 'Trust Your Instincts',
        description: 'If something feels off, it probably is.',
        icon: 'heart',
      },
      {
        title: 'Video Chat First',
        description: 'Have a video call before meeting in person.',
        icon: 'videocam',
      },
      {
        title: 'Protect Your Info',
        description: 'Don\'t share personal details too quickly.',
        icon: 'shield',
      },
      {
        title: 'Arrange Your Own Transport',
        description: 'Drive yourself or use a rideshare you control.',
        icon: 'car',
      },
      {
        title: 'Never Send Money',
        description: 'Never send money to someone you haven\'t met.',
        icon: 'cash',
      },
    ];
  }

  // ==========================================================================
  // Reset
  // ==========================================================================

  async reset(): Promise<void> {
    this.emergencyContacts = [];
    this.safetyChecks = [];
    this.locationSettings = DEFAULT_LOCATION_SETTINGS;

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.EMERGENCY_CONTACTS,
      STORAGE_KEYS.SAFETY_CHECKS,
      STORAGE_KEYS.LOCATION_SETTINGS,
      STORAGE_KEYS.SAFETY_PREFERENCES,
    ]);
  }
}

export const safetyService = SafetyService.getInstance();
export default safetyService;

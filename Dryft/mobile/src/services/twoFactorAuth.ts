import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type TwoFactorMethod = 'sms' | 'email' | 'authenticator' | 'biometric';

export interface TwoFactorStatus {
  isEnabled: boolean;
  enabledMethods: TwoFactorMethod[];
  primaryMethod: TwoFactorMethod | null;
  phoneNumber?: string;
  email?: string;
  hasAuthenticator: boolean;
  hasBiometric: boolean;
  lastVerified?: string;
}

export interface TwoFactorSetupResult {
  success: boolean;
  qrCode?: string;
  secret?: string;
  backupCodes?: string[];
  error?: string;
}

export interface BiometricCapabilities {
  isAvailable: boolean;
  types: LocalAuthentication.AuthenticationType[];
  hasHardware: boolean;
  isEnrolled: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  TWO_FACTOR_STATUS: 'dryft_2fa_status',
  BIOMETRIC_ENABLED: 'dryft_biometric_enabled',
  TRUSTED_DEVICES: 'dryft_trusted_devices',
};

const SECURE_STORE_KEYS = {
  AUTHENTICATOR_SECRET: 'dryft_authenticator_secret',
  BACKUP_CODES: 'dryft_backup_codes',
};

// ============================================================================
// Two Factor Auth Service
// ============================================================================

class TwoFactorAuthService {
  private static instance: TwoFactorAuthService;
  private status: TwoFactorStatus | null = null;
  private biometricCapabilities: BiometricCapabilities | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): TwoFactorAuthService {
    if (!TwoFactorAuthService.instance) {
      TwoFactorAuthService.instance = new TwoFactorAuthService();
    }
    return TwoFactorAuthService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadStatus(),
      this.checkBiometricCapabilities(),
    ]);

    this.initialized = true;
    console.log('[TwoFactorAuth] Initialized');
  }

  private async loadStatus(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.TWO_FACTOR_STATUS);
      if (stored) {
        this.status = JSON.parse(stored);
      } else {
        this.status = {
          isEnabled: false,
          enabledMethods: [],
          primaryMethod: null,
          hasAuthenticator: false,
          hasBiometric: false,
        };
      }
    } catch (error) {
      console.error('[TwoFactorAuth] Failed to load status:', error);
    }
  }

  private async saveStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TWO_FACTOR_STATUS,
        JSON.stringify(this.status)
      );
    } catch (error) {
      console.error('[TwoFactorAuth] Failed to save status:', error);
    }
  }

  // ==========================================================================
  // Biometric Authentication
  // ==========================================================================

  async checkBiometricCapabilities(): Promise<BiometricCapabilities> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      this.biometricCapabilities = {
        isAvailable: hasHardware && isEnrolled,
        types,
        hasHardware,
        isEnrolled,
      };

      return this.biometricCapabilities;
    } catch (error) {
      console.error('[TwoFactorAuth] Biometric check failed:', error);
      return {
        isAvailable: false,
        types: [],
        hasHardware: false,
        isEnrolled: false,
      };
    }
  }

  getBiometricCapabilities(): BiometricCapabilities | null {
    return this.biometricCapabilities;
  }

  getBiometricTypeLabel(): string {
    if (!this.biometricCapabilities?.types.length) return 'Biometric';

    const types = this.biometricCapabilities.types;
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris';
    }
    return 'Biometric';
  }

  async authenticateWithBiometric(reason?: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || 'Verify your identity',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        trackEvent('biometric_auth_success');
        return true;
      }

      trackEvent('biometric_auth_failed', { error: result.error });
      return false;
    } catch (error) {
      console.error('[TwoFactorAuth] Biometric auth failed:', error);
      return false;
    }
  }

  async enableBiometric(): Promise<boolean> {
    const capabilities = await this.checkBiometricCapabilities();
    if (!capabilities.isAvailable) {
      return false;
    }

    // Verify biometric first
    const verified = await this.authenticateWithBiometric(
      'Verify to enable biometric login'
    );
    if (!verified) return false;

    if (this.status) {
      this.status.hasBiometric = true;
      if (!this.status.enabledMethods.includes('biometric')) {
        this.status.enabledMethods.push('biometric');
      }
      this.status.isEnabled = true;
      await this.saveStatus();
    }

    await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');

    trackEvent('biometric_enabled');
    return true;
  }

  async disableBiometric(): Promise<boolean> {
    if (this.status) {
      this.status.hasBiometric = false;
      this.status.enabledMethods = this.status.enabledMethods.filter(
        (m) => m !== 'biometric'
      );
      if (this.status.enabledMethods.length === 0) {
        this.status.isEnabled = false;
        this.status.primaryMethod = null;
      }
      await this.saveStatus();
    }

    await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);

    trackEvent('biometric_disabled');
    return true;
  }

  // ==========================================================================
  // SMS Two-Factor
  // ==========================================================================

  async setupSMS(phoneNumber: string): Promise<TwoFactorSetupResult> {
    try {
      await api.post('/v1/auth/2fa/sms/setup', { phone_number: phoneNumber });

      trackEvent('2fa_sms_setup_started', { phone_masked: this.maskPhone(phoneNumber) });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async verifySMSSetup(code: string): Promise<TwoFactorSetupResult> {
    try {
      const response = await api.post<{ backup_codes: string[] }>(
        '/v1/auth/2fa/sms/verify',
        { code }
      );

      if (this.status) {
        this.status.isEnabled = true;
        if (!this.status.enabledMethods.includes('sms')) {
          this.status.enabledMethods.push('sms');
        }
        this.status.primaryMethod = this.status.primaryMethod || 'sms';
        await this.saveStatus();
      }

      trackEvent('2fa_sms_enabled');

      return {
        success: true,
        backupCodes: response.data!.backup_codes,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Email Two-Factor
  // ==========================================================================

  async setupEmail(email: string): Promise<TwoFactorSetupResult> {
    try {
      await api.post('/v1/auth/2fa/email/setup', { email });

      trackEvent('2fa_email_setup_started');

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async verifyEmailSetup(code: string): Promise<TwoFactorSetupResult> {
    try {
      const response = await api.post<{ backup_codes: string[] }>(
        '/v1/auth/2fa/email/verify',
        { code }
      );

      if (this.status) {
        this.status.isEnabled = true;
        if (!this.status.enabledMethods.includes('email')) {
          this.status.enabledMethods.push('email');
        }
        this.status.primaryMethod = this.status.primaryMethod || 'email';
        await this.saveStatus();
      }

      trackEvent('2fa_email_enabled');

      return {
        success: true,
        backupCodes: response.data!.backup_codes,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Authenticator App
  // ==========================================================================

  async setupAuthenticator(): Promise<TwoFactorSetupResult> {
    try {
      const response = await api.post<{
        qr_code: string;
        secret: string;
      }>('/v1/auth/2fa/authenticator/setup');

      // Store secret securely
      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.AUTHENTICATOR_SECRET,
        response.data!.secret
      );

      trackEvent('2fa_authenticator_setup_started');

      return {
        success: true,
        qrCode: response.data!.qr_code,
        secret: response.data!.secret,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async verifyAuthenticatorSetup(code: string): Promise<TwoFactorSetupResult> {
    try {
      const response = await api.post<{ backup_codes: string[] }>(
        '/v1/auth/2fa/authenticator/verify',
        { code }
      );

      // Store backup codes securely
      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.BACKUP_CODES,
        JSON.stringify(response.data!.backup_codes)
      );

      if (this.status) {
        this.status.isEnabled = true;
        this.status.hasAuthenticator = true;
        if (!this.status.enabledMethods.includes('authenticator')) {
          this.status.enabledMethods.push('authenticator');
        }
        this.status.primaryMethod = 'authenticator';
        await this.saveStatus();
      }

      trackEvent('2fa_authenticator_enabled');

      return {
        success: true,
        backupCodes: response.data!.backup_codes,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Verification
  // ==========================================================================

  async verifyCode(method: TwoFactorMethod, code: string): Promise<boolean> {
    try {
      await api.post('/v1/auth/2fa/verify', { method, code });

      if (this.status) {
        this.status.lastVerified = new Date().toISOString();
        await this.saveStatus();
      }

      trackEvent('2fa_verified', { method });
      return true;
    } catch (error) {
      trackEvent('2fa_verification_failed', { method });
      return false;
    }
  }

  async sendVerificationCode(method: 'sms' | 'email'): Promise<boolean> {
    try {
      await api.post('/v1/auth/2fa/send-code', { method });
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // Backup Codes
  // ==========================================================================

  async getBackupCodes(): Promise<string[]> {
    try {
      const stored = await SecureStore.getItemAsync(SECURE_STORE_KEYS.BACKUP_CODES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  async regenerateBackupCodes(): Promise<string[] | null> {
    try {
      const response = await api.post<{ backup_codes: string[] }>(
        '/v1/auth/2fa/backup-codes/regenerate'
      );

      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.BACKUP_CODES,
        JSON.stringify(response.data!.backup_codes)
      );

      trackEvent('backup_codes_regenerated');

      return response.data!.backup_codes;
    } catch (error) {
      return null;
    }
  }

  async verifyBackupCode(code: string): Promise<boolean> {
    try {
      await api.post('/v1/auth/2fa/backup-codes/verify', { code });

      // Remove used code from local storage
      const codes = await this.getBackupCodes();
      const updatedCodes = codes.filter((c) => c !== code);
      await SecureStore.setItemAsync(
        SECURE_STORE_KEYS.BACKUP_CODES,
        JSON.stringify(updatedCodes)
      );

      trackEvent('backup_code_used');
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // Disable 2FA
  // ==========================================================================

  async disableMethod(method: TwoFactorMethod): Promise<boolean> {
    try {
      await api.post('/v1/auth/2fa/disable', { method });

      if (this.status) {
        this.status.enabledMethods = this.status.enabledMethods.filter(
          (m) => m !== method
        );
        if (method === 'authenticator') {
          this.status.hasAuthenticator = false;
          await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.AUTHENTICATOR_SECRET);
        }
        if (this.status.primaryMethod === method) {
          this.status.primaryMethod = this.status.enabledMethods[0] || null;
        }
        if (this.status.enabledMethods.length === 0) {
          this.status.isEnabled = false;
          await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.BACKUP_CODES);
        }
        await this.saveStatus();
      }

      trackEvent('2fa_method_disabled', { method });
      return true;
    } catch (error) {
      return false;
    }
  }

  async disableAll(): Promise<boolean> {
    try {
      await api.post('/v1/auth/2fa/disable-all');

      this.status = {
        isEnabled: false,
        enabledMethods: [],
        primaryMethod: null,
        hasAuthenticator: false,
        hasBiometric: false,
      };
      await this.saveStatus();

      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.AUTHENTICATOR_SECRET);
      await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.BACKUP_CODES);
      await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);

      trackEvent('2fa_disabled_all');
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getStatus(): TwoFactorStatus | null {
    return this.status ? { ...this.status } : null;
  }

  isEnabled(): boolean {
    return this.status?.isEnabled || false;
  }

  getEnabledMethods(): TwoFactorMethod[] {
    return this.status?.enabledMethods || [];
  }

  getPrimaryMethod(): TwoFactorMethod | null {
    return this.status?.primaryMethod || null;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private maskPhone(phone: string): string {
    if (phone.length < 4) return '****';
    return `****${phone.slice(-4)}`;
  }
}

export const twoFactorAuthService = TwoFactorAuthService.getInstance();
export default twoFactorAuthService;

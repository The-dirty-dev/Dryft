import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Secure storage keys
const KEYS = {
  APP_LOCK_ENABLED: 'dryft_app_lock_enabled',
  BIOMETRIC_ENABLED: 'dryft_biometric_enabled',
  PIN_HASH: 'dryft_pin_hash',
  LOCK_TIMEOUT: 'dryft_lock_timeout',
  LAST_ACTIVE: 'dryft_last_active',
  FAILED_ATTEMPTS: 'dryft_failed_attempts',
  LOCKOUT_UNTIL: 'dryft_lockout_until',
};

// Lock timeout options (in milliseconds)
export const LOCK_TIMEOUT_OPTIONS = {
  IMMEDIATE: 0,
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  NEVER: -1,
};

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
  securityLevel: LocalAuthentication.SecurityLevel;
}

export interface AppLockSettings {
  isEnabled: boolean;
  biometricEnabled: boolean;
  hasPIN: boolean;
  lockTimeout: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

class BiometricAuthService {
  private capabilities: BiometricCapabilities | null = null;

  /**
   * Check device biometric capabilities
   */
  async checkCapabilities(): Promise<BiometricCapabilities> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: BiometricType = 'none';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'facial';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'iris';
    }

    this.capabilities = {
      isAvailable: hasHardware && isEnrolled,
      biometricType,
      isEnrolled,
      securityLevel,
    };

    return this.capabilities;
  }

  /**
   * Get friendly name for biometric type
   */
  getBiometricName(): string {
    if (!this.capabilities) return 'Biometrics';

    switch (this.capabilities.biometricType) {
      case 'facial':
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometrics';
    }
  }

  /**
   * Authenticate with biometrics
   */
  async authenticateWithBiometrics(
    promptMessage?: string
  ): Promise<AuthResult> {
    try {
      // Check if locked out
      const lockoutUntil = await SecureStore.getItemAsync(KEYS.LOCKOUT_UNTIL);
      if (lockoutUntil && Date.now() < parseInt(lockoutUntil, 10)) {
        const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
        return {
          success: false,
          error: `Too many attempts. Try again in ${remaining} seconds.`,
          errorCode: 'LOCKOUT',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to access Dryft',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        // Reset failed attempts on success
        await SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS);
        await this.updateLastActive();
        return { success: true };
      }

      // Handle failure
      await this.incrementFailedAttempts();

      return {
        success: false,
        error: result.error || 'Authentication failed',
        errorCode: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Authentication error',
        errorCode: 'ERROR',
      };
    }
  }

  /**
   * Authenticate with PIN
   */
  async authenticateWithPIN(pin: string): Promise<AuthResult> {
    try {
      // Check if locked out
      const lockoutUntil = await SecureStore.getItemAsync(KEYS.LOCKOUT_UNTIL);
      if (lockoutUntil && Date.now() < parseInt(lockoutUntil, 10)) {
        const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
        return {
          success: false,
          error: `Too many attempts. Try again in ${remaining} seconds.`,
          errorCode: 'LOCKOUT',
        };
      }

      const storedHash = await SecureStore.getItemAsync(KEYS.PIN_HASH);
      if (!storedHash) {
        return { success: false, error: 'PIN not set', errorCode: 'NO_PIN' };
      }

      const inputHash = await this.hashPIN(pin);

      if (inputHash === storedHash) {
        // Reset failed attempts on success
        await SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS);
        await this.updateLastActive();
        return { success: true };
      }

      // Handle failure
      await this.incrementFailedAttempts();

      return {
        success: false,
        error: 'Incorrect PIN',
        errorCode: 'INVALID_PIN',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Authentication error',
        errorCode: 'ERROR',
      };
    }
  }

  /**
   * Set up a new PIN
   */
  async setupPIN(pin: string): Promise<boolean> {
    if (pin.length < 4 || pin.length > 6) {
      throw new Error('PIN must be 4-6 digits');
    }

    if (!/^\d+$/.test(pin)) {
      throw new Error('PIN must contain only numbers');
    }

    const hash = await this.hashPIN(pin);
    await SecureStore.setItemAsync(KEYS.PIN_HASH, hash);
    return true;
  }

  /**
   * Change existing PIN
   */
  async changePIN(currentPIN: string, newPIN: string): Promise<AuthResult> {
    const authResult = await this.authenticateWithPIN(currentPIN);
    if (!authResult.success) {
      return authResult;
    }

    await this.setupPIN(newPIN);
    return { success: true };
  }

  /**
   * Remove PIN
   */
  async removePIN(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.PIN_HASH);
  }

  /**
   * Check if PIN is set
   */
  async hasPIN(): Promise<boolean> {
    const hash = await SecureStore.getItemAsync(KEYS.PIN_HASH);
    return !!hash;
  }

  /**
   * Enable/disable app lock
   */
  async setAppLockEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(KEYS.APP_LOCK_ENABLED, enabled ? 'true' : 'false');
  }

  /**
   * Check if app lock is enabled
   */
  async isAppLockEnabled(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.APP_LOCK_ENABLED);
    return value === 'true';
  }

  /**
   * Enable/disable biometric authentication
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
  }

  /**
   * Check if biometric is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED);
    return value === 'true';
  }

  /**
   * Set lock timeout
   */
  async setLockTimeout(timeout: number): Promise<void> {
    await SecureStore.setItemAsync(KEYS.LOCK_TIMEOUT, timeout.toString());
  }

  /**
   * Get lock timeout
   */
  async getLockTimeout(): Promise<number> {
    const value = await SecureStore.getItemAsync(KEYS.LOCK_TIMEOUT);
    return value ? parseInt(value, 10) : LOCK_TIMEOUT_OPTIONS.IMMEDIATE;
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(): Promise<void> {
    await SecureStore.setItemAsync(KEYS.LAST_ACTIVE, Date.now().toString());
  }

  /**
   * Check if app should be locked based on timeout
   */
  async shouldLock(): Promise<boolean> {
    const isEnabled = await this.isAppLockEnabled();
    if (!isEnabled) return false;

    const timeout = await this.getLockTimeout();
    if (timeout === LOCK_TIMEOUT_OPTIONS.NEVER) return false;

    const lastActive = await SecureStore.getItemAsync(KEYS.LAST_ACTIVE);
    if (!lastActive) return true;

    const elapsed = Date.now() - parseInt(lastActive, 10);
    return elapsed >= timeout;
  }

  /**
   * Get current app lock settings
   */
  async getSettings(): Promise<AppLockSettings> {
    const [isEnabled, biometricEnabled, hasPIN, lockTimeout] = await Promise.all([
      this.isAppLockEnabled(),
      this.isBiometricEnabled(),
      this.hasPIN(),
      this.getLockTimeout(),
    ]);

    return {
      isEnabled,
      biometricEnabled,
      hasPIN,
      lockTimeout,
    };
  }

  /**
   * Get remaining lockout time in seconds
   */
  async getRemainingLockoutTime(): Promise<number> {
    const lockoutUntil = await SecureStore.getItemAsync(KEYS.LOCKOUT_UNTIL);
    if (!lockoutUntil) return 0;

    const remaining = parseInt(lockoutUntil, 10) - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Get number of failed attempts
   */
  async getFailedAttempts(): Promise<number> {
    const attempts = await SecureStore.getItemAsync(KEYS.FAILED_ATTEMPTS);
    return attempts ? parseInt(attempts, 10) : 0;
  }

  /**
   * Reset all security settings (for logout)
   */
  async resetAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.APP_LOCK_ENABLED),
      SecureStore.deleteItemAsync(KEYS.BIOMETRIC_ENABLED),
      SecureStore.deleteItemAsync(KEYS.PIN_HASH),
      SecureStore.deleteItemAsync(KEYS.LOCK_TIMEOUT),
      SecureStore.deleteItemAsync(KEYS.LAST_ACTIVE),
      SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS),
      SecureStore.deleteItemAsync(KEYS.LOCKOUT_UNTIL),
    ]);
  }

  // Private methods

  private async hashPIN(pin: string): Promise<string> {
    // Simple hash for demo - in production, use proper crypto
    // with a per-user salt stored securely
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'dryft_salt_v1');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async incrementFailedAttempts(): Promise<void> {
    const attempts = await this.getFailedAttempts();
    const newAttempts = attempts + 1;

    await SecureStore.setItemAsync(KEYS.FAILED_ATTEMPTS, newAttempts.toString());

    // Lock out after max attempts
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION;
      await SecureStore.setItemAsync(KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
    }
  }
}

export const biometricAuth = new BiometricAuthService();

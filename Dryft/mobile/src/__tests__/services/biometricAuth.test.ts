import { biometricAuth } from '../../services/biometricAuth';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FACIAL_RECOGNITION: 1,
    FINGERPRINT: 2,
    IRIS: 3,
  },
  SecurityLevel: {
    NONE: 0,
    SECRET: 3,
  },
}));

describe('biometricAuth service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects face ID capability and returns friendly name', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(3);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      (LocalAuthentication as any).AuthenticationType.FACIAL_RECOGNITION,
    ]);

    const caps = await biometricAuth.checkCapabilities();

    expect(caps.isAvailable).toBe(true);
    expect(biometricAuth.getBiometricName()).toBe('Face ID');
  });
});

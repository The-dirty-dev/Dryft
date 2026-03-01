import React from 'react';
import { render, screen } from '@testing-library/react-native';
import CompanionScreen from '../../screens/companion/CompanionScreen';

jest.mock('../../hooks/useCompanionSession', () => ({
  useCompanionSession: () => ({
    isConnected: false,
    isJoining: false,
    error: null,
    session: null,
    vrState: null,
    chatMessages: [],
    securityAlert: null,
    joinSession: jest.fn(),
    leaveSession: jest.fn(),
    sendChat: jest.fn(),
    sendHaptic: jest.fn(),
    setHapticPermission: jest.fn(),
    reportCaptureDetected: jest.fn(),
    dismissSecurityAlert: jest.fn(),
  }),
}));

jest.mock('../../hooks/useHaptic', () => ({
  useHaptic: () => ({
    isConnected: false,
    localDevices: [],
    vibrate: jest.fn(),
  }),
}));

jest.mock('../../hooks/useVoiceChat', () => ({
  useVoiceChat: () => ({
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    participants: [],
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    toggleMute: jest.fn(),
    toggleDeafen: jest.fn(),
  }),
}));

jest.mock('@components/ScreenSecurity', () => ({
  SecureScreen: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ScreenCaptureIndicator: () => null,
}));

jest.mock('@hooks/useScreenSecurity', () => ({
  usePreventScreenshot: jest.fn(),
}));

describe('CompanionScreen', () => {
  it('renders join session UI when not connected', () => {
    (global as any).__mockRoute = { params: {} };

    render(<CompanionScreen />);

    expect(screen.getByText('Join VR Session')).toBeTruthy();
    expect(screen.getByText('Join Session')).toBeTruthy();
  });
});

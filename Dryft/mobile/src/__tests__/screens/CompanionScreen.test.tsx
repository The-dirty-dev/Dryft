import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CompanionScreen from '../../screens/companion/CompanionScreen';

const mockJoinSession = jest.fn();
const mockLeaveSession = jest.fn();

let mockCompanionState: any = {};

jest.mock('../../hooks/useCompanionSession', () => ({
  useCompanionSession: () => mockCompanionState,
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
  beforeEach(() => {
    mockCompanionState = {
      isConnected: false,
      isJoining: false,
      error: null,
      session: null,
      vrState: null,
      chatMessages: [],
      securityAlert: null,
      joinSession: mockJoinSession,
      leaveSession: mockLeaveSession,
      sendChat: jest.fn(),
      sendHaptic: jest.fn(),
      setHapticPermission: jest.fn(),
      reportCaptureDetected: jest.fn(),
      dismissSecurityAlert: jest.fn(),
    };
    (global as any).__mockRoute = { params: { sessionCode: '123456' } };
    jest.clearAllMocks();
  });

  it('renders join session state when disconnected', () => {
    render(<CompanionScreen />);

    expect(screen.getByText('Join VR Session')).toBeTruthy();
    expect(screen.getByText('Join Session')).toBeTruthy();
  });

  it('calls joinSession when Join Session is pressed', async () => {
    render(<CompanionScreen />);

    fireEvent.press(screen.getByText('Join Session'));

    await waitFor(() => {
      expect(mockJoinSession).toHaveBeenCalled();
    });
  });

  it('shows connected controls when a session is active', () => {
    mockCompanionState = {
      ...mockCompanionState,
      isConnected: true,
      session: {
        session: { id: 'session-1', code: 'ABC123' },
        participants: [],
      },
      vrState: { haptic_device_name: 'Connected' },
    };

    render(<CompanionScreen />);

    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('Leave')).toBeTruthy();
  });
});

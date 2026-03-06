import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IncomingCallScreen } from '../../screens/calls/IncomingCallScreen';

const mockRejectCall = jest.fn();
const mockSetHandlers = jest.fn();

jest.mock('../../services/callSignaling', () => ({
  callSignalingService: {
    rejectCall: (...args: any[]) => mockRejectCall(...args),
    setHandlers: (...args: any[]) => mockSetHandlers(...args),
  },
}));

describe('CallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__mockRoute = {
      params: {
        callId: 'call-1',
        callerId: 'user-2',
        callerName: 'Jordan',
        callerPhoto: null,
        videoEnabled: true,
        matchId: 'match-1',
      },
    };
  });

  it('renders incoming call controls', () => {
    render(<IncomingCallScreen />);

    expect(screen.getByText('Jordan')).toBeTruthy();
    expect(screen.getByText('Incoming Video Call')).toBeTruthy();
    expect(screen.getByText('Decline')).toBeTruthy();
    expect(screen.getByText('Accept')).toBeTruthy();
  });

  it('rejects and exits when Decline is pressed', async () => {
    render(<IncomingCallScreen />);

    fireEvent.press(screen.getByText('Decline'));

    await waitFor(() => {
      expect(mockRejectCall).toHaveBeenCalledWith('call-1', 'user-2', 'declined');
      expect((global as any).__mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  it('accepts and navigates to VideoCall screen', async () => {
    render(<IncomingCallScreen />);

    fireEvent.press(screen.getByText('Accept'));

    await waitFor(() => {
      expect((global as any).__mockNavigation.replace).toHaveBeenCalledWith('VideoCall', {
        matchId: 'match-1',
        userId: 'user-2',
        userName: 'Jordan',
        isIncoming: true,
        videoEnabled: true,
        callId: 'call-1',
      });
    });
  });
});

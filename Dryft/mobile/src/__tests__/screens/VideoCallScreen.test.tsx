import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { VideoCallScreen } from '../../screens/calls/VideoCallScreen';

let webrtcHandlers: any = {};
let signalingHandlers: any = {};

const mockCreatePeerConnection = jest.fn(async () => undefined);
const mockStartLocalStream = jest.fn(async () => undefined);
const mockCreateOffer = jest.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' }));
const mockCleanup = jest.fn();

jest.mock('../../services/webrtc', () => ({
  webRTCService: {
    setHandlers: (handlers: any) => {
      webrtcHandlers = handlers;
    },
    startLocalStream: (...args: any[]) => mockStartLocalStream(...args),
    createPeerConnection: (...args: any[]) => mockCreatePeerConnection(...args),
    createOffer: (...args: any[]) => mockCreateOffer(...args),
    createAnswer: jest.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' })),
    setRemoteDescription: jest.fn(async () => undefined),
    addIceCandidate: jest.fn(async () => undefined),
    toggleMute: jest.fn(() => true),
    toggleVideo: jest.fn(() => true),
    switchCamera: jest.fn(),
    endCall: jest.fn(),
    cleanup: (...args: any[]) => mockCleanup(...args),
    onIceCandidate: null,
  },
}));

jest.mock('../../services/callSignaling', () => ({
  callSignalingService: {
    setHandlers: (handlers: any) => {
      signalingHandlers = handlers;
    },
    sendOffer: jest.fn(),
    sendAnswer: jest.fn(),
    sendIceCandidate: jest.fn(),
    acceptCall: jest.fn(),
    endCall: jest.fn(),
    sendMuteStatus: jest.fn(),
    sendVideoStatus: jest.fn(),
  },
}));

jest.mock('react-native-webrtc', () => ({
  RTCView: () => null,
}));

describe('VideoCallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webrtcHandlers = {};
    signalingHandlers = {};

    (global as any).__mockRoute = {
      params: {
        matchId: 'match-1',
        userId: 'user-2',
        userName: 'Taylor',
        isIncoming: false,
        videoEnabled: true,
        callId: 'call-1',
      },
    };
  });

  it('renders remote user name and starts in calling state', async () => {
    render(<VideoCallScreen />);

    expect(screen.getByText('Taylor')).toBeTruthy();

    await waitFor(() => {
      expect(mockCreatePeerConnection).toHaveBeenCalled();
      expect(mockCreateOffer).toHaveBeenCalled();
    });
  }, 15000);

  it('updates call status to connected when handler emits connected state', async () => {
    render(<VideoCallScreen />);

    await waitFor(() => expect(webrtcHandlers.onCallStateChange).toBeDefined());

    webrtcHandlers.onCallStateChange('connected');

    expect(screen.getByText('0:00')).toBeTruthy();
  });

  it('navigates back when remote end signal is received', async () => {
    render(<VideoCallScreen />);

    await waitFor(() => expect(signalingHandlers.onCallEnded).toBeDefined());

    signalingHandlers.onCallEnded('call-1');

    expect((global as any).__mockNavigation.goBack).toHaveBeenCalled();
    expect(mockCleanup).toHaveBeenCalled();
  });
});

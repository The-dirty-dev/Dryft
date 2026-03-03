import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VideoCallModal from '@/components/calls/VideoCallModal';

const webRtcMock = vi.hoisted(() => {
  let handlers: any = null;
  const api: any = {
    setHandlers: vi.fn((h: any) => {
      handlers = h;
    }),
    startLocalStream: vi.fn(async () => ({
      getTracks: () => [],
      getAudioTracks: () => [{ enabled: true, stop: vi.fn() }],
      getVideoTracks: () => [{ enabled: true, stop: vi.fn() }],
    })),
    createPeerConnection: vi.fn(async () => ({})),
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'offer' })),
    createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'answer' })),
    setRemoteDescription: vi.fn(async () => {}),
    addIceCandidate: vi.fn(async () => {}),
    toggleMute: vi.fn(() => true),
    toggleVideo: vi.fn(() => true),
    endCall: vi.fn(),
    cleanup: vi.fn(),
    onIceCandidate: null,
    __getHandlers: () => handlers,
  };
  return api;
});

const signalingMock = vi.hoisted(() => {
  let handlers: any = null;
  return {
    setHandlers: vi.fn((h: any) => {
      handlers = h;
    }),
    sendOffer: vi.fn(),
    sendAnswer: vi.fn(),
    sendIceCandidate: vi.fn(),
    sendMuteStatus: vi.fn(),
    sendVideoStatus: vi.fn(),
    acceptCall: vi.fn(),
    endCall: vi.fn(),
    __getHandlers: () => handlers,
  };
});

vi.mock('@/lib/webrtc', () => ({
  __esModule: true,
  webRTCService: webRtcMock,
  default: webRtcMock,
}));

vi.mock('@/lib/callSignaling', () => ({
  __esModule: true,
  callSignalingService: signalingMock,
  default: signalingMock,
}));

describe('VideoCallModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    webRtcMock.setHandlers.mockClear();
    webRtcMock.startLocalStream.mockClear();
    webRtcMock.createPeerConnection.mockClear();
    webRtcMock.createOffer.mockClear();
    webRtcMock.toggleMute.mockClear();
    webRtcMock.toggleVideo.mockClear();
    webRtcMock.endCall.mockClear();
    webRtcMock.cleanup.mockClear();

    signalingMock.setHandlers.mockClear();
    signalingMock.sendOffer.mockClear();
    signalingMock.sendMuteStatus.mockClear();
    signalingMock.sendVideoStatus.mockClear();
    signalingMock.endCall.mockClear();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <VideoCallModal
        isOpen={false}
        onClose={() => {}}
        matchId="match-1"
        userId="user-1"
        userName="Taylor"
        isIncoming={false}
        videoEnabled
        callId="call-1"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('initializes outgoing call and sends offer', async () => {
    render(
      <VideoCallModal
        isOpen
        onClose={() => {}}
        matchId="match-1"
        userId="user-1"
        userName="Taylor"
        isIncoming={false}
        videoEnabled
        callId="call-1"
      />
    );

    await waitFor(() => {
      expect(webRtcMock.startLocalStream).toHaveBeenCalledWith(true);
      expect(webRtcMock.createPeerConnection).toHaveBeenCalled();
      expect(webRtcMock.createOffer).toHaveBeenCalled();
      expect(signalingMock.sendOffer).toHaveBeenCalledWith('user-1', { type: 'offer', sdp: 'offer' });
    });

    expect(screen.getAllByText('Taylor').length).toBeGreaterThan(0);
  });

  it('toggles mute/video and ends call from controls', async () => {
    const onClose = vi.fn();
    render(
      <VideoCallModal
        isOpen
        onClose={onClose}
        matchId="match-2"
        userId="user-2"
        userName="Alex"
        isIncoming={false}
        videoEnabled
        callId="call-2"
      />
    );

    await waitFor(() => {
      expect(webRtcMock.createOffer).toHaveBeenCalled();
    });

    const buttons = screen.getAllByRole('button');
    // top-close, mute, video, end
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);
    fireEvent.click(buttons[3]);

    expect(webRtcMock.toggleMute).toHaveBeenCalled();
    expect(webRtcMock.toggleVideo).toHaveBeenCalled();
    expect(signalingMock.sendMuteStatus).toHaveBeenCalledWith('user-2', true);
    expect(signalingMock.sendVideoStatus).toHaveBeenCalledWith('user-2', true);
    expect(signalingMock.endCall).toHaveBeenCalledWith('user-2');
    expect(webRtcMock.endCall).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

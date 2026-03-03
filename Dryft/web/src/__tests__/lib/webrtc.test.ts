import { beforeEach, describe, expect, it, vi } from 'vitest';
import webRTCService from '@/lib/webrtc';

class MockRTCPeerConnection {
  static lastConfig: any;

  connectionState: RTCPeerConnectionState = 'new';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;

  ontrack: ((ev: RTCTrackEvent) => any) | null = null;
  onicecandidate: ((ev: RTCPeerConnectionIceEvent) => any) | null = null;
  onconnectionstatechange: ((ev: Event) => any) | null = null;

  constructor(config: RTCConfiguration) {
    MockRTCPeerConnection.lastConfig = config;
  }

  addTrack = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' } as RTCSessionDescriptionInit));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' } as RTCSessionDescriptionInit));
  setLocalDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.localDescription = desc;
  });
  setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = desc;
  });
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn(() => {
    this.connectionState = 'closed';
  });
}

class MockRTCSessionDescription {
  constructor(public readonly desc: RTCSessionDescriptionInit) {}
}

class MockRTCIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;

  constructor(candidate: RTCIceCandidateInit) {
    this.candidate = candidate.candidate || '';
    this.sdpMid = candidate.sdpMid ?? null;
    this.sdpMLineIndex = candidate.sdpMLineIndex ?? null;
  }
}

describe('webRTCService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;
    (globalThis as any).RTCSessionDescription = MockRTCSessionDescription;
    (globalThis as any).RTCIceCandidate = MockRTCIceCandidate;

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
          const audioTrack = { enabled: true, stop: vi.fn(), kind: 'audio' } as unknown as MediaStreamTrack;
          const videoTrack = { enabled: true, stop: vi.fn(), kind: 'video' } as unknown as MediaStreamTrack;
          return {
            constraints,
            getTracks: () => [audioTrack, videoTrack],
            getAudioTracks: () => [audioTrack],
            getVideoTracks: () => [videoTrack],
          } as unknown as MediaStream;
        }),
      },
    });

    webRTCService.cleanup();
  });

  it('builds local media constraints for audio-only calls', async () => {
    const stream = await webRTCService.startLocalStream(false);
    expect(stream).toBeTruthy();

    const getUserMediaMock = navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>;
    expect(getUserMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: true,
        video: false,
      })
    );
  });

  it('creates peer connection with configured ICE servers', async () => {
    webRTCService.setConfig({ iceServers: [{ urls: 'stun:custom.example.org:3478' }] });
    await webRTCService.startLocalStream(true);

    await webRTCService.createPeerConnection();

    expect(MockRTCPeerConnection.lastConfig).toEqual({
      iceServers: [{ urls: 'stun:custom.example.org:3478' }],
    });
  });

  it('transitions state to calling on createOffer', async () => {
    await webRTCService.startLocalStream(true);
    await webRTCService.createPeerConnection();

    const offer = await webRTCService.createOffer();

    expect(offer.type).toBe('offer');
    expect(webRTCService.getCallState()).toBe('calling');
  });

  it('toggles local mute and video flags', async () => {
    await webRTCService.startLocalStream(true);

    const muted = webRTCService.toggleMute();
    const videoOff = webRTCService.toggleVideo();

    expect(muted).toBe(true);
    expect(videoOff).toBe(true);
    expect(webRTCService.isMuted()).toBe(true);
    expect(webRTCService.isVideoOff()).toBe(true);
  });
});

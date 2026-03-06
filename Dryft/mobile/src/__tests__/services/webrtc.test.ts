import webRTCService, { webRTCService as namedWebRTCService } from '../../services/webrtc';

describe('services/webrtc', () => {
  it('exports webRTC singleton', () => {
    expect(webRTCService).toBeDefined();
  });

  it('default and named exports point to same instance', () => {
    expect(webRTCService).toBe(namedWebRTCService);
  });

  it('exposes peer connection lifecycle methods', () => {
    expect(typeof (webRTCService as any).createPeerConnection).toBe('function');
    expect(typeof (webRTCService as any).endCall).toBe('function');
  });
});

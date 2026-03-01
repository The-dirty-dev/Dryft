export interface RTCConfig {
  iceServers: RTCIceServer[];
}

const defaultConfig: RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallState =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended';

export interface CallEventHandlers {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onCallStateChange: (state: CallState) => void;
  onError: (error: Error) => void;
}

class WebRTCService {
  private static instance: WebRTCService;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: RTCConfig = defaultConfig;
  private handlers: CallEventHandlers | null = null;
  private callState: CallState = 'idle';

  private constructor() {}

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  setConfig(config: RTCConfig) {
    this.config = config;
  }

  setHandlers(handlers: CallEventHandlers) {
    this.handlers = handlers;
  }

  private setCallState(state: CallState) {
    this.callState = state;
    this.handlers?.onCallStateChange(state);
  }

  getCallState(): CallState {
    return this.callState;
  }

  async startLocalStream(videoEnabled: boolean): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: videoEnabled ? {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.handlers?.onLocalStream(this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Failed to get local stream:', error);
      this.handlers?.onError(error as Error);
      throw error;
    }
  }

  async createPeerConnection(): Promise<RTCPeerConnection> {
    this.peerConnection = new RTCPeerConnection(this.config);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote track received');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.handlers?.onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.peerConnection?.connectionState);

      switch (this.peerConnection?.connectionState) {
        case 'connected':
          this.setCallState('connected');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          this.setCallState('ended');
          break;
      }
    };

    return this.peerConnection;
  }

  onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.setCallState('calling');

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.setCallState('connecting');

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(sdp: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      console.warn('[WebRTC] Peer connection not ready for ICE candidate');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[WebRTC] Failed to add ICE candidate:', error);
    }
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled;
    }
    return false;
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled;
    }
    return false;
  }

  isMuted(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    return audioTrack ? !audioTrack.enabled : false;
  }

  isVideoOff(): boolean {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    return videoTrack ? !videoTrack.enabled : true;
  }

  endCall() {
    console.log('[WebRTC] Ending call');

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.setCallState('ended');
  }

  cleanup() {
    this.endCall();
    this.handlers = null;
    this.onIceCandidate = null;
    this.callState = 'idle';
  }
}

export const webRTCService = WebRTCService.getInstance();
export default webRTCService;

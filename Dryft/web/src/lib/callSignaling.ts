import chatSocketService from './chatSocket';

export type SignalType =
  | 'call_request'
  | 'call_accept'
  | 'call_reject'
  | 'call_end'
  | 'call_busy'
  | 'call_offer'
  | 'call_answer'
  | 'call_candidate'
  | 'call_mute'
  | 'call_unmute'
  | 'call_video_off'
  | 'call_video_on';

export interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  videoEnabled: boolean;
  matchId: string;
}

export interface CallSignalingEvents {
  onIncomingCall: (call: IncomingCall) => void;
  onCallAccepted: (callId: string) => void;
  onCallRejected: (callId: string, reason?: string) => void;
  onCallEnded: (callId: string, reason?: string) => void;
  onCallBusy: (callId: string) => void;
  onOffer: (callId: string, sdp: RTCSessionDescriptionInit) => void;
  onAnswer: (callId: string, sdp: RTCSessionDescriptionInit) => void;
  onIceCandidate: (callId: string, candidate: RTCIceCandidateInit) => void;
  onRemoteMute: (callId: string, muted: boolean) => void;
  onRemoteVideoOff: (callId: string, videoOff: boolean) => void;
}

class CallSignalingService {
  private static instance: CallSignalingService;
  private handlers: Partial<CallSignalingEvents> = {};
  private currentCallId: string | null = null;

  private constructor() {
    // Set up handlers on the chat socket to receive call events
    this.setupChatSocketHandlers();
  }

  static getInstance(): CallSignalingService {
    if (!CallSignalingService.instance) {
      CallSignalingService.instance = new CallSignalingService();
    }
    return CallSignalingService.instance;
  }

  private setupChatSocketHandlers() {
    // The chat socket will call these when it receives call-related events
    // We register for call events via the extended handlers
  }

  setHandlers(handlers: Partial<CallSignalingEvents>) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // Handle incoming call events from chat socket
  handleCallEvent(type: string, payload: any) {
    switch (type) {
      case 'call_request':
        this.handlers.onIncomingCall?.({
          callId: payload.call_id,
          callerId: payload.caller_id,
          callerName: payload.caller_name || 'Unknown',
          callerPhoto: payload.caller_photo,
          videoEnabled: payload.video_enabled || false,
          matchId: payload.match_id,
        });
        break;

      case 'call_accept':
        this.handlers.onCallAccepted?.(payload.call_id);
        break;

      case 'call_reject':
        this.handlers.onCallRejected?.(payload.call_id, payload.reason);
        break;

      case 'call_end':
        this.handlers.onCallEnded?.(payload.call_id, payload.reason);
        break;

      case 'call_busy':
        this.handlers.onCallBusy?.(payload.call_id);
        break;

      case 'call_offer':
        this.handlers.onOffer?.(payload.call_id, payload.sdp);
        break;

      case 'call_answer':
        this.handlers.onAnswer?.(payload.call_id, payload.sdp);
        break;

      case 'call_candidate':
        this.handlers.onIceCandidate?.(payload.call_id, payload.candidate);
        break;

      case 'call_mute':
        this.handlers.onRemoteMute?.(payload.call_id, true);
        break;

      case 'call_unmute':
        this.handlers.onRemoteMute?.(payload.call_id, false);
        break;

      case 'call_video_off':
        this.handlers.onRemoteVideoOff?.(payload.call_id, true);
        break;

      case 'call_video_on':
        this.handlers.onRemoteVideoOff?.(payload.call_id, false);
        break;
    }
  }

  isConnectedToSignaling(): boolean {
    return chatSocketService.isConnected();
  }

  initiateCall(
    callId: string,
    toUserId: string,
    matchId: string,
    videoEnabled: boolean
  ) {
    this.currentCallId = callId;
    this.sendSignal('call_request', {
      call_id: callId,
      target_user_id: toUserId,
      match_id: matchId,
      video_enabled: videoEnabled,
    });
  }

  acceptCall(callId: string, fromUserId: string) {
    this.currentCallId = callId;
    this.sendSignal('call_accept', {
      call_id: callId,
      target_user_id: fromUserId,
    });
  }

  rejectCall(callId: string, fromUserId: string, reason?: string) {
    this.sendSignal('call_reject', {
      call_id: callId,
      target_user_id: fromUserId,
      reason,
    });
  }

  endCall(toUserId: string) {
    if (!this.currentCallId) return;

    this.sendSignal('call_end', {
      call_id: this.currentCallId,
      target_user_id: toUserId,
    });

    this.currentCallId = null;
  }

  sendOffer(toUserId: string, sdp: RTCSessionDescriptionInit) {
    if (!this.currentCallId) return;

    this.sendSignal('call_offer', {
      call_id: this.currentCallId,
      target_user_id: toUserId,
      sdp,
    });
  }

  sendAnswer(toUserId: string, sdp: RTCSessionDescriptionInit) {
    if (!this.currentCallId) return;

    this.sendSignal('call_answer', {
      call_id: this.currentCallId,
      target_user_id: toUserId,
      sdp,
    });
  }

  sendIceCandidate(toUserId: string, candidate: RTCIceCandidate) {
    if (!this.currentCallId) return;

    this.sendSignal('call_candidate', {
      call_id: this.currentCallId,
      target_user_id: toUserId,
      candidate: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      },
    });
  }

  sendMuteStatus(toUserId: string, muted: boolean) {
    if (!this.currentCallId) return;

    this.sendSignal(muted ? 'call_mute' : 'call_unmute', {
      call_id: this.currentCallId,
      target_user_id: toUserId,
    });
  }

  sendVideoStatus(toUserId: string, videoOff: boolean) {
    if (!this.currentCallId) return;

    this.sendSignal(videoOff ? 'call_video_off' : 'call_video_on', {
      call_id: this.currentCallId,
      target_user_id: toUserId,
    });
  }

  getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  /**
   * Connect to call signaling. This is a no-op since we use the shared chat socket.
   */
  async connect(): Promise<void> {
    // Call signaling uses the chat socket which is managed separately
    // This method exists for API compatibility
  }

  /**
   * Disconnect from call signaling. Clears handlers and current call state.
   */
  disconnect() {
    this.handlers = {};
    this.currentCallId = null;
  }

  private sendSignal(type: string, payload: any) {
    // Use the chat socket's internal send method
    // We need to expose this from chatSocket
    chatSocketService.sendCallSignal(type, payload);
  }
}

export const callSignalingService = CallSignalingService.getInstance();
export default callSignalingService;

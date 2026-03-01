'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { callSignalingService, IncomingCall } from '@/lib/callSignaling';
import { useAuthStore } from '@/store/authStore';

export interface CallConfig {
  matchId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  videoEnabled: boolean;
}

export interface ActiveCall extends CallConfig {
  callId: string;
  isIncoming: boolean;
}

/**
 * React hook for call signaling state and actions (accept/decline/end).
 * @returns Incoming/active call state plus call control helpers.
 * @example
 * const { incomingCall, initiateCall, acceptIncomingCall } = useCalls();
 * if (incomingCall) acceptIncomingCall();
 * const callId = initiateCall({ matchId, userId, userName, videoEnabled: true });
 * @remarks
 * WebSocket events handled (via chat socket signaling): `call_request`, `call_accept`,
 * `call_reject`, `call_end`, `call_busy`, `call_offer`, `call_answer`,
 * `call_candidate`, `call_mute`, `call_unmute`, `call_video_off`, `call_video_on`.
 */
export function useCalls() {
  const { isAuthenticated } = useAuthStore();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !initialized.current) {
      initialized.current = true;
      initializeCallSignaling();
    }

    return () => {
      if (!isAuthenticated) {
        callSignalingService.disconnect();
        initialized.current = false;
      }
    };
  }, [isAuthenticated]);

  const initializeCallSignaling = async () => {
    try {
      await callSignalingService.connect();

      callSignalingService.setHandlers({
        onIncomingCall: handleIncomingCall,
        onCallBusy: handleCallBusy,
        onCallEnded: handleCallEnded,
      });
    } catch (error) {
      console.error('[useCalls] Failed to connect:', error);
    }
  };

  const handleIncomingCall = useCallback((call: IncomingCall) => {
    console.log('[useCalls] Incoming call:', call);
    setIncomingCall(call);
  }, []);

  const handleCallBusy = useCallback((callId: string) => {
    console.log('[useCalls] Call busy:', callId);
    if (activeCall?.callId === callId) {
      setActiveCall(null);
    }
  }, [activeCall]);

  const handleCallEnded = useCallback((callId: string) => {
    console.log('[useCalls] Call ended:', callId);
    if (activeCall?.callId === callId) {
      setActiveCall(null);
    }
    if (incomingCall?.callId === callId) {
      setIncomingCall(null);
    }
  }, [activeCall, incomingCall]);

  const initiateCall = useCallback((config: CallConfig) => {
    const callId = uuidv4();

    setActiveCall({
      ...config,
      callId,
      isIncoming: false,
    });

    callSignalingService.initiateCall(
      callId,
      config.userId,
      config.matchId,
      config.videoEnabled
    );

    return callId;
  }, []);

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    setActiveCall({
      callId: incomingCall.callId,
      matchId: incomingCall.matchId,
      userId: incomingCall.callerId,
      userName: incomingCall.callerName,
      userPhoto: incomingCall.callerPhoto,
      videoEnabled: incomingCall.videoEnabled,
      isIncoming: true,
    });

    setIncomingCall(null);
  }, [incomingCall]);

  const declineIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    callSignalingService.rejectCall(
      incomingCall.callId,
      incomingCall.callerId,
      'declined'
    );
    setIncomingCall(null);
  }, [incomingCall]);

  const endCall = useCallback(() => {
    if (!activeCall) return;
    callSignalingService.endCall(activeCall.userId);
    setActiveCall(null);
  }, [activeCall]);

  return {
    incomingCall,
    activeCall,
    initiateCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    isConnected: callSignalingService.isConnectedToSignaling(),
  };
}

export default useCalls;

import { useEffect, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import { callSignalingService, IncomingCall } from '../services/callSignaling';
import { RootStackParamList } from '../navigation';
import { useAuthStore } from '../store/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * React hook `useCalls`.
 * @returns Hook state and actions.
 * @example
 * const value = useCalls();
 */
export function useCalls() {
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated } = useAuthStore();
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
      });
    } catch (error) {
      console.error('[useCalls] Failed to connect:', error);
    }
  };

  const handleIncomingCall = useCallback((call: IncomingCall) => {
    console.log('[useCalls] Incoming call:', call);

    navigation.navigate('IncomingCall', {
      callId: call.callId,
      callerId: call.callerId,
      callerName: call.callerName,
      callerPhoto: call.callerPhoto,
      videoEnabled: call.videoEnabled,
      matchId: call.matchId,
    });
  }, [navigation]);

  const handleCallBusy = useCallback((callId: string) => {
    console.log('[useCalls] Call busy:', callId);
    // Show toast or alert
  }, []);

  const initiateCall = useCallback(async (
    matchId: string,
    userId: string,
    userName: string,
    videoEnabled: boolean
  ) => {
    const callId = uuidv4();

    // Navigate to video call screen
    navigation.navigate('VideoCall', {
      matchId,
      userId,
      userName,
      isIncoming: false,
      videoEnabled,
      callId,
    });

    // Send call request through signaling
    callSignalingService.initiateCall(callId, userId, matchId, videoEnabled);
  }, [navigation]);

  return {
    initiateCall,
    isConnected: callSignalingService.isConnectedToSignaling(),
  };
}

export default useCalls;

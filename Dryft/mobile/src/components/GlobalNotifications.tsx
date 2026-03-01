import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useChatSocket } from '../hooks/useChatSocket';
import { useToast } from './Toast';
import { RootStackParamList } from '../navigation';
import { voipPushService, VoIPPushPayload } from '../services/voipPush';
import { callKeepService } from '../services/callKeep';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function GlobalNotifications() {
  const navigation = useNavigation<NavigationProp>();
  const { showMatchNotification } = useToast();
  const initialized = useRef(false);

  // Initialize VoIP push and CallKeep for incoming calls
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initCallServices = async () => {
      try {
        // Initialize CallKeep (iOS CallKit / Android ConnectionService)
        await callKeepService.initialize();

        // Set up CallKeep handlers
        callKeepService.setHandlers({
          onAnswerCall: (callUUID) => {
            console.log('[GlobalNotifications] Call answered via CallKit:', callUUID);
            // Navigation will be handled by the incoming call handler
          },
          onEndCall: (callUUID) => {
            console.log('[GlobalNotifications] Call ended via CallKit:', callUUID);
            // Clean up call state
          },
        });

        // Initialize VoIP push for iOS
        if (Platform.OS === 'ios') {
          await voipPushService.initialize();

          // Handle incoming calls from VoIP push
          voipPushService.setHandlers({
            onIncomingCall: (payload: VoIPPushPayload) => {
              console.log('[GlobalNotifications] Incoming call from VoIP push:', payload);

              // Navigate to incoming call screen
              navigation.navigate('IncomingCall', {
                callId: payload.call_id,
                callerId: payload.caller_id,
                callerName: payload.caller_name,
                callerPhoto: payload.caller_photo,
                videoEnabled: payload.video_enabled,
                matchId: payload.match_id,
              });
            },
          });
        }

        console.log('[GlobalNotifications] Call services initialized');
      } catch (error) {
        console.error('[GlobalNotifications] Failed to initialize call services:', error);
      }
    };

    initCallServices();

    return () => {
      callKeepService.cleanup();
    };
  }, [navigation]);

  useChatSocket({
    onNewMatch: (payload) => {
      showMatchNotification(
        payload.user.display_name,
        payload.user.photo_url,
        () => {
          navigation.navigate('Chat' as any, {
            matchId: payload.match_id,
            user: {
              id: payload.user.id,
              display_name: payload.user.display_name,
              profile_photo: payload.user.photo_url,
            },
          });
        }
      );
    },
  });

  return null;
}

export default GlobalNotifications;

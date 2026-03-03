import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
} from 'react-native-webrtc';
import { WS_ORIGIN_URL } from '../config';

const WS_URL = WS_ORIGIN_URL || (__DEV__ ? 'ws://localhost:8080' : 'ws://api.dryft.site:8080');

export interface VoiceParticipant {
  id: string;
  displayName: string;
  isSpeaking: boolean;
  volume: number;
  isMuted: boolean;
}

export interface VoiceChatState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  error: string | null;
  participants: VoiceParticipant[];
}

/**
 * React hook `useVoiceChat`.
 * @param sessionId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useVoiceChat(sessionId);
 */
export function useVoiceChat(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);

  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    error: null,
    participants: [],
  });

  // Request microphone permission
  const requestMicPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Dryft needs access to your microphone for voice chat',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('[VoiceChat] Permission error:', err);
        return false;
      }
    }
    // iOS permission is handled by the system when accessing media
    return true;
  };

  // Start local audio stream
  const startLocalStream = async (): Promise<MediaStream | null> => {
    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        setState(prev => ({ ...prev, error: 'Microphone permission denied' }));
        return null;
      }

      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('[VoiceChat] Failed to get audio stream:', err);
      setState(prev => ({ ...prev, error: 'Failed to access microphone' }));
      return null;
    }
  };

  // Connect to voice server
  const connect = useCallback(async () => {
    if (!sessionId || state.isConnected || state.isConnecting) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Start local audio
      const stream = await startLocalStream();
      if (!stream) {
        setState(prev => ({ ...prev, isConnecting: false }));
        return;
      }

      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}/v1/voice/session/${sessionId}`);

      ws.onopen = () => {
        console.log('[VoiceChat] Connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));

        // Send join message
        ws.send(JSON.stringify({
          type: 'voice_join',
          session_id: sessionId,
        }));
      };

      ws.onclose = () => {
        console.log('[VoiceChat] Disconnected');
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));
      };

      ws.onerror = (error) => {
        console.error('[VoiceChat] WebSocket error:', error);
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: 'Connection error',
        }));
      };

      ws.onmessage = (event) => {
        handleMessage(event.data);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[VoiceChat] Connect error:', err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }));
    }
  }, [sessionId, state.isConnected, state.isConnecting]);

  // Disconnect from voice server
  const disconnect = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      participants: [],
    }));
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((data: string) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'voice_speaking':
          setState(prev => ({
            ...prev,
            participants: prev.participants.map(p =>
              p.id === message.user_id
                ? { ...p, isSpeaking: message.speaking }
                : p
            ),
          }));
          break;

        case 'voice_participant_joined':
          setState(prev => ({
            ...prev,
            participants: [
              ...prev.participants.filter(p => p.id !== message.user_id),
              {
                id: message.user_id,
                displayName: message.display_name || 'User',
                isSpeaking: false,
                volume: 1,
                isMuted: false,
              },
            ],
          }));
          break;

        case 'voice_participant_left':
          setState(prev => ({
            ...prev,
            participants: prev.participants.filter(p => p.id !== message.user_id),
          }));
          break;

        case 'voice_error':
          setState(prev => ({ ...prev, error: message.error }));
          break;
      }
    } catch (err) {
      console.error('[VoiceChat] Message parse error:', err);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = state.isMuted; // Toggle
        setState(prev => ({ ...prev, isMuted: !prev.isMuted }));

        // Notify server
        wsRef.current?.send(JSON.stringify({
          type: 'voice_mute',
          muted: !state.isMuted,
        }));
      }
    }
  }, [state.isMuted]);

  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    setState(prev => {
      const newDeafened = !prev.isDeafened;
      return {
        ...prev,
        isDeafened: newDeafened,
        isMuted: newDeafened ? true : prev.isMuted, // Mute when deafened
      };
    });

    // Mute local stream when deafened
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = state.isDeafened; // If was deafened, unmute
      }
    }
  }, [state.isDeafened]);

  // Set participant volume
  const setParticipantVolume = useCallback((participantId: string, volume: number) => {
    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.id === participantId ? { ...p, volume: Math.max(0, Math.min(1, volume)) } : p
      ),
    }));
  }, []);

  // Mute specific participant
  const muteParticipant = useCallback((participantId: string, muted: boolean) => {
    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.id === participantId ? { ...p, isMuted: muted } : p
      ),
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Auto-disconnect when session changes
  useEffect(() => {
    if (!sessionId && state.isConnected) {
      disconnect();
    }
  }, [sessionId, state.isConnected, disconnect]);

  return {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
    setParticipantVolume,
    muteParticipant,
  };
}

export default useVoiceChat;

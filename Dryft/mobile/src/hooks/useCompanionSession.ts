import { useState, useEffect, useCallback, useRef } from 'react';
import * as sessionApi from '../api/session';
import { useHaptic } from './useHaptic';
import apiClient from '../api/client';
import { WS_BASE_URL } from '../config';

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  timestamp: number;
}

export interface SecurityEvent {
  userId: string;
  displayName?: string;
  deviceType: 'vr' | 'mobile';
  captureType?: 'screenshot' | 'recording';
  timestamp: number;
}

export interface SessionState {
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;
  session: sessionApi.SessionInfo | null;
  vrState: sessionApi.VRState | null;
  chatMessages: ChatMessage[];
  securityAlert: SecurityEvent | null;
}

/**
 * React hook `useCompanionSession`.
 * @returns Hook state and actions.
 * @example
 * const value = useCompanionSession();
 */
export function useCompanionSession() {
  const { vibrate, stopAllDevices, isConnected: hapticConnected } = useHaptic();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<SessionState>({
    isConnected: false,
    isJoining: false,
    error: null,
    session: null,
    vrState: null,
    chatMessages: [],
    securityAlert: null,
  });

  // ==========================================================================
  // WebSocket Connection
  // ==========================================================================

  const connectWebSocket = useCallback((token: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE_URL}?token=${token}`);

    ws.onopen = () => {
      console.log('[CompanionSession] WebSocket connected');
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    };

    ws.onclose = () => {
      console.log('[CompanionSession] WebSocket closed');
      setState(prev => ({ ...prev, isConnected: false }));

      // Reconnect after 3 seconds
      if (state.session) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(token);
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('[CompanionSession] WebSocket error:', error);
      setState(prev => ({ ...prev, error: 'Connection error' }));
    };

    ws.onmessage = (event) => {
      handleWebSocketMessage(event.data);
    };

    wsRef.current = ws;
  }, [state.session]);

  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // ==========================================================================
  // WebSocket Message Handling
  // ==========================================================================

  const handleWebSocketMessage = useCallback((data: string) => {
    try {
      const envelope = JSON.parse(data);
      const { type, payload } = envelope;

      switch (type) {
        case 'session_joined':
          handleSessionJoined(payload);
          break;
        case 'session_user_joined':
          handleUserJoined(payload);
          break;
        case 'session_user_left':
          handleUserLeft(payload);
          break;
        case 'session_state':
          handleVRState(payload);
          break;
        case 'session_chat':
          handleChatMessage(payload);
          break;
        case 'session_haptic':
          handleHapticCommand(payload);
          break;
        case 'session_ended':
          handleSessionEnded(payload);
          break;
        case 'security_recording_detected':
        case 'security_capture_detected':
          handleSecurityAlert(payload);
          break;
        case 'security_recording_stopped':
          clearSecurityAlert();
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('[CompanionSession] Error parsing message:', err);
    }
  }, []);

  const handleSessionJoined = useCallback((payload: any) => {
    setState(prev => ({
      ...prev,
      session: {
        session: payload.session || prev.session?.session,
        participants: payload.participants || [],
        host: payload.host,
      } as sessionApi.SessionInfo,
      vrState: payload.vr_state || null,
    }));
  }, []);

  const handleUserJoined = useCallback((payload: any) => {
    setState(prev => {
      if (!prev.session) return prev;
      return {
        ...prev,
        session: {
          ...prev.session,
          participants: [...prev.session.participants, payload.user],
        },
      };
    });
  }, []);

  const handleUserLeft = useCallback((payload: any) => {
    setState(prev => {
      if (!prev.session) return prev;
      return {
        ...prev,
        session: {
          ...prev.session,
          participants: prev.session.participants.filter(
            p => p.user_id !== payload.user_id
          ),
        },
      };
    });
  }, []);

  const handleVRState = useCallback((payload: sessionApi.VRState) => {
    setState(prev => ({ ...prev, vrState: payload }));
  }, []);

  const handleChatMessage = useCallback((payload: any) => {
    const message: ChatMessage = {
      id: `${payload.timestamp}-${payload.user_id}`,
      userId: payload.user_id,
      displayName: payload.display_name,
      content: payload.content,
      timestamp: payload.timestamp,
    };

    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, message].slice(-100),
    }));
  }, []);

  const handleHapticCommand = useCallback(async (payload: any) => {
    if (!hapticConnected) return;

    try {
      switch (payload.command_type) {
        case 'vibrate':
          await vibrate(0, payload.intensity || 0.5, payload.duration_ms || 1000);
          break;
        case 'stop':
          await stopAllDevices();
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('[CompanionSession] Haptic command failed:', err);
    }
  }, [hapticConnected, vibrate, stopAllDevices]);

  const handleSessionEnded = useCallback((payload: any) => {
    setState(prev => ({
      ...prev,
      session: null,
      vrState: null,
      error: `Session ended: ${payload.reason}`,
    }));
    disconnectWebSocket();
  }, [disconnectWebSocket]);

  const handleSecurityAlert = useCallback((payload: any) => {
    const alert: SecurityEvent = {
      userId: payload.userId || payload.user_id,
      displayName: payload.displayName || payload.display_name,
      deviceType: payload.deviceType || payload.device_type || 'unknown',
      captureType: payload.captureType || payload.capture_type,
      timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
    };

    setState(prev => ({ ...prev, securityAlert: alert }));

    // Auto-clear after 10 seconds
    setTimeout(() => {
      setState(prev => {
        if (prev.securityAlert?.timestamp === alert.timestamp) {
          return { ...prev, securityAlert: null };
        }
        return prev;
      });
    }, 10000);
  }, []);

  const clearSecurityAlert = useCallback(() => {
    setState(prev => ({ ...prev, securityAlert: null }));
  }, []);

  // ==========================================================================
  // Session Actions
  // ==========================================================================

  const joinSession = useCallback(async (sessionCode: string, displayName?: string) => {
    setState(prev => ({ ...prev, isJoining: true, error: null }));

    try {
      const response = await sessionApi.joinSession({
        session_code: sessionCode,
        display_name: displayName,
        device_type: 'mobile',
      });

      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          isJoining: false,
          session: response.data!,
        }));

        // Connect WebSocket
        const token = apiClient.accessToken;
        if (token) {
          connectWebSocket(token);
        }

        return true;
      } else {
        setState(prev => ({
          ...prev,
          isJoining: false,
          error: response.error || 'Failed to join session',
        }));
        return false;
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        isJoining: false,
        error: err instanceof Error ? err.message : 'Failed to join session',
      }));
      return false;
    }
  }, [connectWebSocket]);

  const leaveSession = useCallback(async () => {
    if (!state.session) return;

    try {
      await sessionApi.leaveSession(state.session.session.id);
    } catch (err) {
      console.error('[CompanionSession] Leave failed:', err);
    }

    setState(prev => ({
      ...prev,
      session: null,
      vrState: null,
      chatMessages: [],
    }));

    disconnectWebSocket();
  }, [state.session, disconnectWebSocket]);

  const sendChat = useCallback(async (content: string) => {
    if (!state.session) return;

    try {
      await sessionApi.sendSessionChat(state.session.session.id, content);
    } catch (err) {
      console.error('[CompanionSession] Send chat failed:', err);
    }
  }, [state.session]);

  const sendHaptic = useCallback(async (
    toUserId: string,
    commandType: 'vibrate' | 'pattern' | 'stop',
    options?: { intensity?: number; durationMs?: number; patternName?: string }
  ) => {
    if (!state.session) return;

    try {
      await sessionApi.sendSessionHaptic(state.session.session.id, {
        to_user_id: toUserId,
        command_type: commandType,
        intensity: options?.intensity,
        duration_ms: options?.durationMs,
        pattern_name: options?.patternName,
      });
    } catch (err) {
      console.error('[CompanionSession] Send haptic failed:', err);
    }
  }, [state.session]);

  const setHapticPermission = useCallback(async (
    controllerId: string,
    permissionType: 'always' | 'request' | 'never',
    maxIntensity?: number
  ) => {
    if (!state.session) return;

    try {
      await sessionApi.setHapticPermission(state.session.session.id, {
        controller_id: controllerId,
        permission_type: permissionType,
        max_intensity: maxIntensity,
      });
    } catch (err) {
      console.error('[CompanionSession] Set permission failed:', err);
    }
  }, [state.session]);

  /**
   * Report screen capture detection to the session
   * This notifies other participants that capture was detected
   */
  const reportCaptureDetected = useCallback((captureType: 'screenshot' | 'recording') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!state.session) return;

    wsRef.current.send(JSON.stringify({
      type: 'mobile:capture_detected',
      payload: {
        sessionCode: state.session.session.session_code,
        captureType,
      },
    }));

    console.log(`[CompanionSession] Reported ${captureType} detection to session`);
  }, [state.session]);

  /**
   * Dismiss the current security alert
   */
  const dismissSecurityAlert = useCallback(() => {
    clearSecurityAlert();
  }, [clearSecurityAlert]);

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    ...state,

    // Actions
    joinSession,
    leaveSession,
    sendChat,
    sendHaptic,
    setHapticPermission,

    // Security
    reportCaptureDetected,
    dismissSecurityAlert,
  };
}

export default useCompanionSession;

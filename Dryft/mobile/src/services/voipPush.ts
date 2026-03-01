import { Platform } from 'react-native';
import { api } from './api';
import { useAuthStore } from '../store/authStore';

// VoIP push notification types
export interface VoIPPushPayload {
  call_id: string;
  caller_id: string;
  caller_name: string;
  caller_photo?: string;
  match_id: string;
  video_enabled: boolean;
}

export interface VoIPPushEvents {
  onIncomingCall: (payload: VoIPPushPayload) => void;
}

class VoIPPushService {
  private static instance: VoIPPushService;
  private voipToken: string | null = null;
  private handlers: Partial<VoIPPushEvents> = {};
  private initialized = false;

  private constructor() {}

  static getInstance(): VoIPPushService {
    if (!VoIPPushService.instance) {
      VoIPPushService.instance = new VoIPPushService();
    }
    return VoIPPushService.instance;
  }

  setHandlers(handlers: Partial<VoIPPushEvents>) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // VoIP push is iOS only
    if (Platform.OS !== 'ios') {
      console.log('[VoIPPush] VoIP push is iOS only');
      return;
    }

    try {
      // Dynamically import to avoid Android crash
      const VoipPushNotification = await import('react-native-voip-push-notification');
      const RNVoipPushNotification = VoipPushNotification.default;

      // Request VoIP push permissions
      RNVoipPushNotification.requestPermissions();

      // Register for VoIP token
      RNVoipPushNotification.addEventListener('register', (token: string) => {
        console.log('[VoIPPush] Token received:', token.substring(0, 20) + '...');
        this.voipToken = token;
        this.registerTokenWithBackend(token);
      });

      // Handle incoming VoIP push notification
      RNVoipPushNotification.addEventListener(
        'notification',
        (notification: VoIPPushPayload) => {
          console.log('[VoIPPush] Notification received:', notification);

          // Report incoming call to CallKit
          this.reportIncomingCall(notification);

          // Notify handlers
          this.handlers.onIncomingCall?.(notification);
        }
      );

      // Handle did load with events (for when app was killed)
      RNVoipPushNotification.addEventListener('didLoadWithEvents', (events: any[]) => {
        if (!events || events.length === 0) return;

        console.log('[VoIPPush] Did load with events:', events.length);

        // Process the most recent incoming call
        const callEvents = events.filter((e) => e.name === 'RNVoipPushRemoteNotificationsRegisteredEvent');
        if (callEvents.length > 0) {
          const latestCall = callEvents[callEvents.length - 1];
          this.handlers.onIncomingCall?.(latestCall.data);
        }
      });

      // Register for VoIP notifications
      RNVoipPushNotification.registerVoipToken();

      this.initialized = true;
      console.log('[VoIPPush] Initialized');
    } catch (error) {
      console.error('[VoIPPush] Initialization error:', error);
    }
  }

  private async reportIncomingCall(payload: VoIPPushPayload): Promise<void> {
    try {
      // Dynamically import CallKeep
      const RNCallKeep = (await import('react-native-callkeep')).default;

      // Display incoming call UI via CallKit
      RNCallKeep.displayIncomingCall(
        payload.call_id,
        payload.caller_name,
        payload.caller_name,
        'generic',
        payload.video_enabled
      );

      console.log('[VoIPPush] Reported incoming call to CallKit');
    } catch (error) {
      console.error('[VoIPPush] Failed to report incoming call:', error);
    }
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const authToken = useAuthStore.getState().token;
      if (!authToken) {
        console.log('[VoIPPush] No auth token, skipping registration');
        return;
      }

      await api.post('/v1/notifications/voip-devices', {
        token,
        platform: 'ios',
        bundle_id: 'com.dryft.app', // Update with actual bundle ID
      });

      console.log('[VoIPPush] Token registered with backend');
    } catch (error) {
      console.error('[VoIPPush] Failed to register token:', error);
    }
  }

  async unregister(): Promise<void> {
    if (Platform.OS !== 'ios') return;

    try {
      const authToken = useAuthStore.getState().token;
      if (authToken && this.voipToken) {
        await api.delete('/v1/notifications/voip-devices', {
          data: { token: this.voipToken },
        });
        console.log('[VoIPPush] Token unregistered');
      }
    } catch (error) {
      console.error('[VoIPPush] Failed to unregister:', error);
    }

    this.voipToken = null;
    this.initialized = false;
  }

  getToken(): string | null {
    return this.voipToken;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const voipPushService = VoIPPushService.getInstance();
export default voipPushService;

import { Platform, AppState, AppStateStatus } from 'react-native';

export interface CallKeepEvents {
  onAnswerCall: (callUUID: string) => void;
  onEndCall: (callUUID: string) => void;
  onToggleMute: (callUUID: string, muted: boolean) => void;
  onToggleHold: (callUUID: string, held: boolean) => void;
  onDTMF: (callUUID: string, digits: string) => void;
  onProviderReset: () => void;
}

class CallKeepService {
  private static instance: CallKeepService;
  private RNCallKeep: any = null;
  private handlers: Partial<CallKeepEvents> = {};
  private initialized = false;
  private activeCallId: string | null = null;

  private constructor() {}

  static getInstance(): CallKeepService {
    if (!CallKeepService.instance) {
      CallKeepService.instance = new CallKeepService();
    }
    return CallKeepService.instance;
  }

  setHandlers(handlers: Partial<CallKeepEvents>) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamically import to handle missing native module gracefully
      this.RNCallKeep = (await import('react-native-callkeep')).default;

      const options = {
        ios: {
          appName: 'Dryft',
          supportsVideo: true,
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
          imageName: 'CallKitLogo',
          ringtoneSound: 'ringtone.wav',
        },
        android: {
          alertTitle: 'Permissions required',
          alertDescription: 'This app needs to access your phone accounts',
          cancelButton: 'Cancel',
          okButton: 'OK',
          imageName: 'phone_account_icon',
          foregroundService: {
            channelId: 'com.dryft.app.calls',
            channelName: 'Dryft Calls',
            notificationTitle: 'Call in progress',
            notificationIcon: 'ic_notification',
          },
          additionalPermissions: [],
        },
      };

      // Setup CallKeep
      await this.RNCallKeep.setup(options);

      // Register event listeners
      this.registerEventListeners();

      // Handle app state changes
      AppState.addEventListener('change', this.handleAppStateChange);

      this.initialized = true;
      console.log('[CallKeep] Initialized');
    } catch (error) {
      console.error('[CallKeep] Initialization error:', error);
    }
  }

  private registerEventListeners(): void {
    if (!this.RNCallKeep) return;

    // Answer call from native UI
    this.RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
      console.log('[CallKeep] Answer call:', callUUID);
      this.handlers.onAnswerCall?.(callUUID);
    });

    // End call from native UI
    this.RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
      console.log('[CallKeep] End call:', callUUID);
      this.activeCallId = null;
      this.handlers.onEndCall?.(callUUID);
    });

    // Mute toggle from native UI
    this.RNCallKeep.addEventListener(
      'didPerformSetMutedCallAction',
      ({ callUUID, muted }: { callUUID: string; muted: boolean }) => {
        console.log('[CallKeep] Mute toggled:', callUUID, muted);
        this.handlers.onToggleMute?.(callUUID, muted);
      }
    );

    // Hold toggle from native UI
    this.RNCallKeep.addEventListener(
      'didToggleHoldCallAction',
      ({ callUUID, hold }: { callUUID: string; hold: boolean }) => {
        console.log('[CallKeep] Hold toggled:', callUUID, hold);
        this.handlers.onToggleHold?.(callUUID, hold);
      }
    );

    // DTMF digits
    this.RNCallKeep.addEventListener(
      'didPerformDTMFAction',
      ({ callUUID, digits }: { callUUID: string; digits: string }) => {
        console.log('[CallKeep] DTMF:', callUUID, digits);
        this.handlers.onDTMF?.(callUUID, digits);
      }
    );

    // Provider reset (iOS)
    this.RNCallKeep.addEventListener('didResetProvider', () => {
      console.log('[CallKeep] Provider reset');
      this.activeCallId = null;
      this.handlers.onProviderReset?.();
    });

    // Audio session activated (iOS)
    this.RNCallKeep.addEventListener('didActivateAudioSession', () => {
      console.log('[CallKeep] Audio session activated');
    });

    // Call state changed (Android)
    this.RNCallKeep.addEventListener(
      'didChangeAudioRoute',
      ({ output }: { output: string }) => {
        console.log('[CallKeep] Audio route changed:', output);
      }
    );
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    // Handle app coming to foreground during call
    if (nextState === 'active' && this.activeCallId) {
      console.log('[CallKeep] App active with call:', this.activeCallId);
    }
  };

  // Display incoming call
  displayIncomingCall(
    callId: string,
    callerName: string,
    callerNumber: string,
    hasVideo: boolean = false
  ): void {
    if (!this.RNCallKeep) {
      console.warn('[CallKeep] Not initialized');
      return;
    }

    this.activeCallId = callId;
    this.RNCallKeep.displayIncomingCall(
      callId,
      callerNumber,
      callerName,
      'generic',
      hasVideo
    );
    console.log('[CallKeep] Displayed incoming call:', callId);
  }

  // Start outgoing call
  startCall(callId: string, callerName: string, hasVideo: boolean = false): void {
    if (!this.RNCallKeep) return;

    this.activeCallId = callId;
    this.RNCallKeep.startCall(callId, callerName, callerName, 'generic', hasVideo);
    console.log('[CallKeep] Started call:', callId);
  }

  // Report call connected
  reportConnectedCall(callId: string): void {
    if (!this.RNCallKeep) return;

    this.RNCallKeep.setCurrentCallActive(callId);
    console.log('[CallKeep] Reported connected:', callId);
  }

  // End call
  endCall(callId: string): void {
    if (!this.RNCallKeep) return;

    this.RNCallKeep.endCall(callId);
    this.activeCallId = null;
    console.log('[CallKeep] Ended call:', callId);
  }

  // End all calls
  endAllCalls(): void {
    if (!this.RNCallKeep) return;

    this.RNCallKeep.endAllCalls();
    this.activeCallId = null;
    console.log('[CallKeep] Ended all calls');
  }

  // Report call ended
  reportEndCall(callId: string, reason: number = 1): void {
    if (!this.RNCallKeep) return;

    // Reasons: 1=failed, 2=remote ended, 3=unanswered, 4=answered elsewhere, 5=declined elsewhere
    this.RNCallKeep.reportEndCallWithUUID(callId, reason);
    this.activeCallId = null;
    console.log('[CallKeep] Reported end call:', callId, 'reason:', reason);
  }

  // Set muted state
  setMutedCall(callId: string, muted: boolean): void {
    if (!this.RNCallKeep) return;

    this.RNCallKeep.setMutedCall(callId, muted);
    console.log('[CallKeep] Set muted:', callId, muted);
  }

  // Set held state
  setOnHold(callId: string, held: boolean): void {
    if (!this.RNCallKeep) return;

    this.RNCallKeep.setOnHold(callId, held);
    console.log('[CallKeep] Set on hold:', callId, held);
  }

  // Update caller display
  updateDisplay(callId: string, name: string, handle: string): void {
    if (!this.RNCallKeep) return;

    this.RNCallKeep.updateDisplay(callId, name, handle);
  }

  // Check if there's an active call
  hasActiveCall(): boolean {
    return this.activeCallId !== null;
  }

  // Get active call ID
  getActiveCallId(): string | null {
    return this.activeCallId;
  }

  // Check if CallKeep is available
  isAvailable(): boolean {
    return this.RNCallKeep !== null && this.initialized;
  }

  // Cleanup
  cleanup(): void {
    if (this.RNCallKeep) {
      this.RNCallKeep.removeEventListener('answerCall');
      this.RNCallKeep.removeEventListener('endCall');
      this.RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
      this.RNCallKeep.removeEventListener('didToggleHoldCallAction');
      this.RNCallKeep.removeEventListener('didPerformDTMFAction');
      this.RNCallKeep.removeEventListener('didResetProvider');
      this.RNCallKeep.removeEventListener('didActivateAudioSession');
      this.RNCallKeep.removeEventListener('didChangeAudioRoute');
    }
  }
}

export const callKeepService = CallKeepService.getInstance();
export default callKeepService;

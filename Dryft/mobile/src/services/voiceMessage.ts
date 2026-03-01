import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export interface VoiceMessage {
  id: string;
  matchId: string;
  senderId: string;
  uri: string;
  remoteUrl?: string;
  duration: number;
  waveform?: number[];
  status: 'recording' | 'uploading' | 'sent' | 'delivered' | 'played' | 'failed';
  createdAt: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  metering?: number[];
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  position: number;
  duration: number;
  playbackRate: number;
}

export type RecordingQuality = 'low' | 'medium' | 'high';

// ============================================================================
// Constants
// ============================================================================

const MAX_RECORDING_DURATION = 60 * 1000; // 60 seconds
const MIN_RECORDING_DURATION = 1000; // 1 second
const METERING_INTERVAL = 100; // ms
const VOICE_MESSAGE_DIR = `${FileSystem.documentDirectory}voice_messages/`;

const RECORDING_OPTIONS: Record<RecordingQuality, Audio.RecordingOptions> = {
  low: {
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 22050,
      numberOfChannels: 1,
      bitRate: 64000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.LOW,
      sampleRate: 22050,
      numberOfChannels: 1,
      bitRate: 64000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 64000,
    },
  },
  medium: {
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.MEDIUM,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  },
  high: {
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 256000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 256000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 256000,
    },
  },
};

// ============================================================================
// Voice Message Service
// ============================================================================

class VoiceMessageService {
  private static instance: VoiceMessageService;
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private meteringInterval: ReturnType<typeof setInterval> | null = null;
  private recordingState: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    metering: [],
  };
  private playbackState: PlaybackState = {
    isPlaying: false,
    isPaused: false,
    position: 0,
    duration: 0,
    playbackRate: 1,
  };
  private recordingStateListeners: Set<(state: RecordingState) => void> = new Set();
  private playbackStateListeners: Set<(state: PlaybackState) => void> = new Set();
  private quality: RecordingQuality = 'medium';

  private constructor() {
    this.ensureDirectory();
  }

  static getInstance(): VoiceMessageService {
    if (!VoiceMessageService.instance) {
      VoiceMessageService.instance = new VoiceMessageService();
    }
    return VoiceMessageService.instance;
  }

  // ==========================================================================
  // Directory Management
  // ==========================================================================

  private async ensureDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(VOICE_MESSAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(VOICE_MESSAGE_DIR, { intermediates: true });
    }
  }

  // ==========================================================================
  // Audio Session Setup
  // ==========================================================================

  async setupAudioSession(): Promise<boolean> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to setup audio session:', error);
      return false;
    }
  }

  // ==========================================================================
  // Recording
  // ==========================================================================

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[VoiceMessage] Permission request failed:', error);
      return false;
    }
  }

  async startRecording(quality: RecordingQuality = 'medium'): Promise<boolean> {
    try {
      // Check permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('[VoiceMessage] No recording permission');
        return false;
      }

      // Stop any existing recording
      if (this.recording) {
        await this.cancelRecording();
      }

      // Setup audio mode for recording
      await this.setupAudioSession();

      this.quality = quality;
      const options = RECORDING_OPTIONS[quality];

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(options);
      this.recording = recording;

      // Start metering
      this.startMetering();

      // Update state
      this.recordingState = {
        isRecording: true,
        isPaused: false,
        duration: 0,
        metering: [],
      };
      this.notifyRecordingStateListeners();

      // Set max duration timeout
      setTimeout(() => {
        if (this.recordingState.isRecording) {
          this.stopRecording();
        }
      }, MAX_RECORDING_DURATION);

      trackEvent('voice_recording_started', { quality });

      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to start recording:', error);
      return false;
    }
  }

  async pauseRecording(): Promise<boolean> {
    if (!this.recording || !this.recordingState.isRecording) return false;

    try {
      await this.recording.pauseAsync();
      this.stopMetering();

      this.recordingState = {
        ...this.recordingState,
        isPaused: true,
      };
      this.notifyRecordingStateListeners();

      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to pause recording:', error);
      return false;
    }
  }

  async resumeRecording(): Promise<boolean> {
    if (!this.recording || !this.recordingState.isPaused) return false;

    try {
      await this.recording.startAsync();
      this.startMetering();

      this.recordingState = {
        ...this.recordingState,
        isPaused: false,
      };
      this.notifyRecordingStateListeners();

      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to resume recording:', error);
      return false;
    }
  }

  async stopRecording(): Promise<{ uri: string; duration: number } | null> {
    if (!this.recording) return null;

    try {
      this.stopMetering();

      const status = await this.recording.getStatusAsync();
      await this.recording.stopAndUnloadAsync();

      const uri = this.recording.getURI();
      this.recording = null;

      const duration = status.durationMillis || 0;

      // Check minimum duration
      if (duration < MIN_RECORDING_DURATION) {
        console.warn('[VoiceMessage] Recording too short');
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
        this.recordingState = {
          isRecording: false,
          isPaused: false,
          duration: 0,
          metering: [],
        };
        this.notifyRecordingStateListeners();
        return null;
      }

      // Move to permanent storage
      const filename = `voice_${Date.now()}.m4a`;
      const permanentUri = `${VOICE_MESSAGE_DIR}${filename}`;

      if (uri) {
        await FileSystem.moveAsync({
          from: uri,
          to: permanentUri,
        });
      }

      // Reset state
      const metering = [...(this.recordingState.metering || [])];
      this.recordingState = {
        isRecording: false,
        isPaused: false,
        duration: 0,
        metering: [],
      };
      this.notifyRecordingStateListeners();

      trackEvent('voice_recording_completed', {
        duration: Math.round(duration / 1000),
        quality: this.quality,
      });

      return {
        uri: permanentUri,
        duration,
      };
    } catch (error) {
      console.error('[VoiceMessage] Failed to stop recording:', error);
      return null;
    }
  }

  async cancelRecording(): Promise<void> {
    if (!this.recording) return;

    try {
      this.stopMetering();

      const uri = this.recording.getURI();
      await this.recording.stopAndUnloadAsync();
      this.recording = null;

      // Delete the file
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }

      this.recordingState = {
        isRecording: false,
        isPaused: false,
        duration: 0,
        metering: [],
      };
      this.notifyRecordingStateListeners();

      trackEvent('voice_recording_cancelled');
    } catch (error) {
      console.error('[VoiceMessage] Failed to cancel recording:', error);
    }
  }

  private startMetering(): void {
    if (this.meteringInterval) return;

    this.meteringInterval = setInterval(async () => {
      if (!this.recording) return;

      try {
        const status = await this.recording.getStatusAsync();
        if (status.isRecording) {
          const metering = this.recordingState.metering || [];
          const normalizedLevel = status.metering
            ? Math.max(0, Math.min(1, (status.metering + 60) / 60))
            : 0;

          this.recordingState = {
            ...this.recordingState,
            duration: status.durationMillis || 0,
            metering: [...metering, normalizedLevel],
          };
          this.notifyRecordingStateListeners();
        }
      } catch (error) {
        // Ignore metering errors
      }
    }, METERING_INTERVAL);
  }

  private stopMetering(): void {
    if (this.meteringInterval) {
      clearInterval(this.meteringInterval);
      this.meteringInterval = null;
    }
  }

  // ==========================================================================
  // Playback
  // ==========================================================================

  async loadAudio(uri: string): Promise<boolean> {
    try {
      // Unload existing sound
      await this.unloadAudio();

      // Setup audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        this.onPlaybackStatusUpdate
      );

      this.sound = sound;

      if (status.isLoaded) {
        this.playbackState = {
          isPlaying: false,
          isPaused: false,
          position: 0,
          duration: status.durationMillis || 0,
          playbackRate: 1,
        };
        this.notifyPlaybackStateListeners();
      }

      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to load audio:', error);
      return false;
    }
  }

  async play(): Promise<boolean> {
    if (!this.sound) return false;

    try {
      await this.sound.playAsync();
      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to play:', error);
      return false;
    }
  }

  async pause(): Promise<boolean> {
    if (!this.sound) return false;

    try {
      await this.sound.pauseAsync();
      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to pause:', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    if (!this.sound) return false;

    try {
      await this.sound.stopAsync();
      await this.sound.setPositionAsync(0);
      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to stop:', error);
      return false;
    }
  }

  async seekTo(position: number): Promise<boolean> {
    if (!this.sound) return false;

    try {
      await this.sound.setPositionAsync(position);
      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to seek:', error);
      return false;
    }
  }

  async setPlaybackRate(rate: number): Promise<boolean> {
    if (!this.sound) return false;

    try {
      await this.sound.setRateAsync(rate, true);
      this.playbackState = {
        ...this.playbackState,
        playbackRate: rate,
      };
      this.notifyPlaybackStateListeners();
      return true;
    } catch (error) {
      console.error('[VoiceMessage] Failed to set playback rate:', error);
      return false;
    }
  }

  async unloadAudio(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        // Ignore unload errors
      }
      this.sound = null;
    }

    this.playbackState = {
      isPlaying: false,
      isPaused: false,
      position: 0,
      duration: 0,
      playbackRate: 1,
    };
    this.notifyPlaybackStateListeners();
  }

  private onPlaybackStatusUpdate = (status: any) => {
    if (!status.isLoaded) return;

    this.playbackState = {
      isPlaying: status.isPlaying,
      isPaused: !status.isPlaying && status.positionMillis > 0,
      position: status.positionMillis || 0,
      duration: status.durationMillis || 0,
      playbackRate: status.rate || 1,
    };
    this.notifyPlaybackStateListeners();

    // Handle playback finished
    if (status.didJustFinish) {
      this.stop();
    }
  };

  // ==========================================================================
  // Upload & Download
  // ==========================================================================

  async uploadVoiceMessage(
    uri: string,
    matchId: string,
    duration: number
  ): Promise<string | null> {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to server
      const response = await api.post<{ url: string }>('/v1/messages/voice', {
        match_id: matchId,
        audio_data: base64,
        duration,
        format: 'm4a',
      });

      trackEvent('voice_message_uploaded', {
        duration: Math.round(duration / 1000),
      });

      return response.data!.url;
    } catch (error) {
      console.error('[VoiceMessage] Upload failed:', error);
      return null;
    }
  }

  async downloadVoiceMessage(remoteUrl: string): Promise<string | null> {
    try {
      const filename = `voice_${Date.now()}.m4a`;
      const localUri = `${VOICE_MESSAGE_DIR}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(remoteUrl, localUri);

      if (downloadResult.status === 200) {
        return downloadResult.uri;
      }

      return null;
    } catch (error) {
      console.error('[VoiceMessage] Download failed:', error);
      return null;
    }
  }

  // ==========================================================================
  // Waveform Generation
  // ==========================================================================

  generateWaveformFromMetering(metering: number[], samples: number = 40): number[] {
    if (metering.length === 0) return Array(samples).fill(0.1);

    const waveform: number[] = [];
    const samplesPerBar = Math.ceil(metering.length / samples);

    for (let i = 0; i < samples; i++) {
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, metering.length);
      const slice = metering.slice(start, end);

      if (slice.length > 0) {
        const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
        waveform.push(Math.max(0.1, avg));
      } else {
        waveform.push(0.1);
      }
    }

    return waveform;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  async cleanup(): Promise<void> {
    await this.cancelRecording();
    await this.unloadAudio();
  }

  async clearCache(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(VOICE_MESSAGE_DIR);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const file of files) {
        const filePath = `${VOICE_MESSAGE_DIR}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (fileInfo.exists && fileInfo.modificationTime) {
          const age = now - fileInfo.modificationTime * 1000;
          if (age > maxAge) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
          }
        }
      }
    } catch (error) {
      console.error('[VoiceMessage] Cache cleanup failed:', error);
    }
  }

  // ==========================================================================
  // State Subscriptions
  // ==========================================================================

  subscribeToRecordingState(listener: (state: RecordingState) => void): () => void {
    this.recordingStateListeners.add(listener);
    listener(this.recordingState);
    return () => this.recordingStateListeners.delete(listener);
  }

  subscribeToPlaybackState(listener: (state: PlaybackState) => void): () => void {
    this.playbackStateListeners.add(listener);
    listener(this.playbackState);
    return () => this.playbackStateListeners.delete(listener);
  }

  private notifyRecordingStateListeners(): void {
    this.recordingStateListeners.forEach((listener) => listener(this.recordingState));
  }

  private notifyPlaybackStateListeners(): void {
    this.playbackStateListeners.forEach((listener) => listener(this.playbackState));
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getRecordingState(): RecordingState {
    return this.recordingState;
  }

  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  getMaxRecordingDuration(): number {
    return MAX_RECORDING_DURATION;
  }

  getMinRecordingDuration(): number {
    return MIN_RECORDING_DURATION;
  }
}

export const voiceMessageService = VoiceMessageService.getInstance();
export default voiceMessageService;

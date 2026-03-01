import { useState, useEffect, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  voiceMessageService,
  RecordingState,
  PlaybackState,
  RecordingQuality,
} from '../services/voiceMessage';

// ============================================================================
// useVoiceRecording - Handle voice message recording
// ============================================================================

/**
 * React hook `useVoiceRecording`.
 * @param quality - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useVoiceRecording(quality);
 */
export function useVoiceRecording(quality: RecordingQuality = 'medium') {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    metering: [],
  });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = voiceMessageService.subscribeToRecordingState(setRecordingState);
    return unsubscribe;
  }, []);

  const checkPermission = useCallback(async () => {
    const granted = await voiceMessageService.requestPermissions();
    setHasPermission(granted);
    return granted;
  }, []);

  const startRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return voiceMessageService.startRecording(quality);
  }, [quality]);

  const pauseRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return voiceMessageService.pauseRecording();
  }, []);

  const resumeRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return voiceMessageService.resumeRecording();
  }, []);

  const stopRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return voiceMessageService.stopRecording();
  }, []);

  const cancelRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return voiceMessageService.cancelRecording();
  }, []);

  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const waveform = voiceMessageService.generateWaveformFromMetering(
    recordingState.metering || [],
    40
  );

  return {
    // State
    isRecording: recordingState.isRecording,
    isPaused: recordingState.isPaused,
    duration: recordingState.duration,
    formattedDuration: formatDuration(recordingState.duration),
    metering: recordingState.metering || [],
    waveform,
    hasPermission,

    // Actions
    checkPermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,

    // Limits
    maxDuration: voiceMessageService.getMaxRecordingDuration(),
    minDuration: voiceMessageService.getMinRecordingDuration(),
  };
}

// ============================================================================
// useVoicePlayback - Handle voice message playback
// ============================================================================

/**
 * React hook `useVoicePlayback`.
 * @param uri? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useVoicePlayback(uri?);
 */
export function useVoicePlayback(uri?: string) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    position: 0,
    duration: 0,
    playbackRate: 1,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentUriRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = voiceMessageService.subscribeToPlaybackState(setPlaybackState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (uri && uri !== currentUriRef.current) {
      loadAudio(uri);
    }
    return () => {
      if (currentUriRef.current) {
        voiceMessageService.unloadAudio();
      }
    };
  }, [uri]);

  const loadAudio = useCallback(async (audioUri: string) => {
    setIsLoading(true);
    setIsLoaded(false);
    currentUriRef.current = audioUri;

    const success = await voiceMessageService.loadAudio(audioUri);
    setIsLoaded(success);
    setIsLoading(false);

    return success;
  }, []);

  const play = useCallback(async () => {
    if (!isLoaded && uri) {
      await loadAudio(uri);
    }
    return voiceMessageService.play();
  }, [isLoaded, uri, loadAudio]);

  const pause = useCallback(async () => {
    return voiceMessageService.pause();
  }, []);

  const stop = useCallback(async () => {
    return voiceMessageService.stop();
  }, []);

  const togglePlayback = useCallback(async () => {
    if (playbackState.isPlaying) {
      return pause();
    } else {
      return play();
    }
  }, [playbackState.isPlaying, play, pause]);

  const seekTo = useCallback(async (position: number) => {
    return voiceMessageService.seekTo(position);
  }, []);

  const seekForward = useCallback(async (ms: number = 5000) => {
    const newPosition = Math.min(
      playbackState.position + ms,
      playbackState.duration
    );
    return seekTo(newPosition);
  }, [playbackState.position, playbackState.duration, seekTo]);

  const seekBackward = useCallback(async (ms: number = 5000) => {
    const newPosition = Math.max(playbackState.position - ms, 0);
    return seekTo(newPosition);
  }, [playbackState.position, seekTo]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    return voiceMessageService.setPlaybackRate(rate);
  }, []);

  const cyclePlaybackRate = useCallback(async () => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackState.playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    return setPlaybackRate(rates[nextIndex]);
  }, [playbackState.playbackRate, setPlaybackRate]);

  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const progress = playbackState.duration > 0
    ? playbackState.position / playbackState.duration
    : 0;

  return {
    // State
    isLoaded,
    isLoading,
    isPlaying: playbackState.isPlaying,
    isPaused: playbackState.isPaused,
    position: playbackState.position,
    duration: playbackState.duration,
    playbackRate: playbackState.playbackRate,
    progress,
    formattedPosition: formatDuration(playbackState.position),
    formattedDuration: formatDuration(playbackState.duration),

    // Actions
    loadAudio,
    play,
    pause,
    stop,
    togglePlayback,
    seekTo,
    seekForward,
    seekBackward,
    setPlaybackRate,
    cyclePlaybackRate,
  };
}

// ============================================================================
// useVoiceMessageUpload - Handle uploading voice messages
// ============================================================================

/**
 * React hook `useVoiceMessageUpload`.
 * @param matchId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useVoiceMessageUpload(matchId);
 */
export function useVoiceMessageUpload(matchId: string) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (uri: string, duration: number) => {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const remoteUrl = await voiceMessageService.uploadVoiceMessage(
          uri,
          matchId,
          duration
        );

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (remoteUrl) {
          return { success: true, url: remoteUrl };
        } else {
          setError('Failed to upload voice message');
          return { success: false, url: null };
        }
      } catch (err: any) {
        setError(err.message);
        return { success: false, url: null };
      } finally {
        setIsUploading(false);
      }
    },
    [matchId]
  );

  return {
    upload,
    isUploading,
    uploadProgress,
    error,
  };
}

// ============================================================================
// useVoiceMessage - Combined hook for full voice message flow
// ============================================================================

/**
 * React hook `useVoiceMessage`.
 * @param matchId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useVoiceMessage(matchId);
 */
export function useVoiceMessage(matchId: string) {
  const recording = useVoiceRecording('medium');
  const playback = useVoicePlayback();
  const upload = useVoiceMessageUpload(matchId);
  const [pendingMessage, setPendingMessage] = useState<{
    uri: string;
    duration: number;
  } | null>(null);

  const finishRecording = useCallback(async () => {
    const result = await recording.stopRecording();
    if (result) {
      setPendingMessage(result);
      await playback.loadAudio(result.uri);
    }
    return result;
  }, [recording.stopRecording, playback.loadAudio]);

  const sendMessage = useCallback(async () => {
    if (!pendingMessage) return { success: false, url: null };

    const result = await upload.upload(pendingMessage.uri, pendingMessage.duration);
    if (result.success) {
      setPendingMessage(null);
    }
    return result;
  }, [pendingMessage, upload.upload]);

  const discardPending = useCallback(() => {
    setPendingMessage(null);
  }, []);

  return {
    // Recording
    ...recording,

    // Playback
    playback,

    // Upload
    ...upload,

    // Pending message
    pendingMessage,
    finishRecording,
    sendMessage,
    discardPending,
  };
}

export default useVoiceMessage;

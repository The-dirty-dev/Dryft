import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVoiceRecording } from '../../hooks/useVoiceMessage';

// ============================================================================
// Types
// ============================================================================

interface VoiceMessageRecorderProps {
  onRecordingComplete: (uri: string, duration: number, waveform: number[]) => void;
  onCancel: () => void;
  maxDuration?: number;
}

// ============================================================================
// Waveform Visualizer Component
// ============================================================================

function WaveformVisualizer({ metering }: { metering: number[] }) {
  const displayBars = metering.slice(-30);
  const bars = displayBars.length < 30
    ? [...Array(30 - displayBars.length).fill(0.1), ...displayBars]
    : displayBars;

  return (
    <View style={styles.waveformContainer}>
      {bars.map((level, index) => (
        <View
          key={index}
          style={[
            styles.waveformBar,
            {
              height: Math.max(4, level * 40),
              opacity: index < 30 - displayBars.length ? 0.3 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ============================================================================
// Voice Message Recorder Component
// ============================================================================

export function VoiceMessageRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = 60000,
}: VoiceMessageRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    formattedDuration,
    metering,
    waveform,
    hasPermission,
    checkPermission,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording('medium');

  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkPermission();
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, isPaused]);

  const handleStart = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await startRecording();
  };

  const handleStop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await stopRecording();
    if (result) {
      onRecordingComplete(result.uri, result.duration, waveform);
    }
  };

  const handleCancel = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await cancelRecording();
    onCancel();
  };

  const handlePauseResume = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPaused) {
      await resumeRecording();
    } else {
      await pauseRecording();
    }
  };

  const progress = duration / maxDuration;
  const isNearLimit = progress > 0.8;

  if (hasPermission === false) {
    return (
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] },
        ]}
      >
        <View style={styles.permissionError}>
          <Ionicons name="mic-off" size={32} color="#EF4444" />
          <Text style={styles.permissionErrorText}>
            Microphone access is required to record voice messages
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={checkPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] },
      ]}
    >
      {/* Recording indicator */}
      <View style={styles.header}>
        <View style={styles.recordingIndicator}>
          <Animated.View
            style={[
              styles.recordingDot,
              {
                transform: [{ scale: pulseAnim }],
                backgroundColor: isPaused ? '#F59E0B' : '#EF4444',
              },
            ]}
          />
          <Text style={styles.recordingText}>
            {isPaused ? 'Paused' : isRecording ? 'Recording...' : 'Ready'}
          </Text>
        </View>
        <Text style={[styles.duration, isNearLimit && styles.durationWarning]}>
          {formattedDuration}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        {isNearLimit && (
          <Text style={styles.limitWarning}>
            {Math.ceil((maxDuration - duration) / 1000)}s remaining
          </Text>
        )}
      </View>

      {/* Waveform */}
      <WaveformVisualizer metering={metering} />

      {/* Controls */}
      <View style={styles.controls}>
        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Ionicons name="close" size={24} color="#EF4444" />
        </TouchableOpacity>

        {/* Main Record/Stop Button */}
        {!isRecording ? (
          <TouchableOpacity style={styles.recordButton} onPress={handleStart}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.recordButtonGradient}
            >
              <Ionicons name="mic" size={32} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.stopButtonGradient}
            >
              <Ionicons name="stop" size={28} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Pause/Resume Button */}
        {isRecording && (
          <TouchableOpacity style={styles.pauseButton} onPress={handlePauseResume}>
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {!isRecording && (
          <View style={styles.pauseButton}>
            <Ionicons name="pause" size={24} color="#4B5563" />
          </View>
        )}
      </View>

      {/* Instructions */}
      <Text style={styles.instructions}>
        {isRecording
          ? 'Tap the purple button to finish'
          : 'Tap the red button to start recording'}
      </Text>
    </Animated.View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  duration: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  durationWarning: {
    color: '#F59E0B',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },
  limitWarning: {
    position: 'absolute',
    right: 0,
    top: 8,
    fontSize: 12,
    color: '#F59E0B',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 2,
    marginBottom: 24,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  cancelButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  recordButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  stopButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructions: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  permissionError: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
  permissionErrorText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 280,
  },
  permissionButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VoiceMessageRecorder;

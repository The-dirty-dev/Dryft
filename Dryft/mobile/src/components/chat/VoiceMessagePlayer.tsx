import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVoicePlayback } from '../../hooks/useVoiceMessage';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

interface VoiceMessagePlayerProps {
  uri: string;
  duration: number;
  waveform?: number[];
  isSent?: boolean;
  isPlayed?: boolean;
  onPlay?: () => void;
  onPlayed?: () => void;
  compact?: boolean;
}

// ============================================================================
// Waveform Progress Component
// ============================================================================

interface WaveformProgressProps {
  waveform: number[];
  progress: number;
  isSent: boolean;
  onSeek: (progress: number) => void;
}

function WaveformProgress({ waveform, progress, isSent, onSeek }: WaveformProgressProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const containerRef = useRef<View>(null);
  const widthRef = useRef(0);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const newProgress = Math.max(0, Math.min(1, x / widthRef.current));
      onSeek(newProgress);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const newProgress = Math.max(0, Math.min(1, x / widthRef.current));
      onSeek(newProgress);
    },
  });

  return (
    <View
      ref={containerRef}
      style={styles.waveformProgress}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      {waveform.map((level, index) => {
        const barProgress = index / waveform.length;
        const isActive = barProgress <= progress;

        return (
          <View
            key={index}
            style={[
              styles.waveformBar,
              {
                height: Math.max(4, level * 24),
                backgroundColor: isActive
                  ? isSent
                    ? colors.text
                    : colors.accent
                  : isSent
                  ? withAlpha(colors.text, '4D')
                  : withAlpha(colors.accent, '4D'),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ============================================================================
// Voice Message Player Component
// ============================================================================

export function VoiceMessagePlayer({
  uri,
  duration,
  waveform = [],
  isSent = false,
  isPlayed = false,
  onPlay,
  onPlayed,
  compact = false,
}: VoiceMessagePlayerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    isLoading,
    isPlaying,
    progress,
    formattedPosition,
    formattedDuration,
    playbackRate,
    loadAudio,
    togglePlayback,
    seekTo,
    cyclePlaybackRate,
  } = useVoicePlayback();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hasTriggeredPlayedRef = useRef(false);

  useEffect(() => {
    loadAudio(uri);
  }, [uri]);

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (progress > 0.9 && !hasTriggeredPlayedRef.current && !isSent) {
      hasTriggeredPlayedRef.current = true;
      onPlayed?.();
    }
  }, [progress, isSent, onPlayed]);

  const handlePlay = async () => {
    onPlay?.();
    await togglePlayback();
  };

  const handleSeek = (newProgress: number) => {
    seekTo(newProgress * duration);
  };

  // Generate default waveform if none provided
  const displayWaveform =
    waveform.length > 0
      ? waveform
      : Array(40)
          .fill(0)
          .map(() => Math.random() * 0.6 + 0.2);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, isSent && styles.compactContainerSent]}>
        <TouchableOpacity
          style={[styles.compactPlayButton, isSent && styles.compactPlayButtonSent]}
          onPress={handlePlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <Ionicons name="hourglass" size={16} color={isSent ? colors.accent : colors.text} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={16}
              color={isSent ? colors.accent : colors.text}
            />
          )}
        </TouchableOpacity>

        <View style={styles.compactProgress}>
          <View
            style={[
              styles.compactProgressBar,
              {
                width: `${progress * 100}%`,
                backgroundColor: isSent ? colors.text : colors.accent,
              },
            ]}
          />
        </View>

        <Text style={[styles.compactDuration, isSent && styles.compactDurationSent]}>
          {isPlaying ? formattedPosition : formatDuration(duration)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isSent && styles.containerSent]}>
      {/* Play Button */}
      <TouchableOpacity
        style={[styles.playButton, isSent && styles.playButtonSent]}
        onPress={handlePlay}
        disabled={isLoading}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {isLoading ? (
            <Ionicons name="hourglass" size={24} color={isSent ? colors.accent : colors.text} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={isSent ? colors.accent : colors.text}
            />
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* Waveform & Time */}
      <View style={styles.content}>
        <WaveformProgress
          waveform={displayWaveform}
          progress={progress}
          isSent={isSent}
          onSeek={handleSeek}
        />

        <View style={styles.timeRow}>
          <Text style={[styles.time, isSent && styles.timeSent]}>
            {isPlaying ? formattedPosition : formatDuration(duration)}
          </Text>

          {/* Playback Rate */}
          <TouchableOpacity
            style={[styles.rateButton, isSent && styles.rateButtonSent]}
            onPress={cyclePlaybackRate}
          >
            <Text style={[styles.rateText, isSent && styles.rateTextSent]}>
              {playbackRate}x
            </Text>
          </TouchableOpacity>

          {/* Played indicator */}
          {!isSent && isPlayed && (
            <View style={styles.playedIndicator}>
              <Ionicons name="checkmark" size={12} color={colors.success} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    minWidth: 200,
  },
  containerSent: {
    backgroundColor: colors.accent,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonSent: {
    backgroundColor: colors.text,
  },
  content: {
    flex: 1,
  },
  waveformProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 2,
    marginBottom: 4,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
    maxWidth: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  timeSent: {
    color: colors.textSecondary,
  },
  rateButton: {
    backgroundColor: withAlpha(colors.accent, '33'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rateButtonSent: {
    backgroundColor: withAlpha(colors.text, '33'),
  },
  rateText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  rateTextSent: {
    color: colors.text,
  },
  playedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  compactContainerSent: {
    backgroundColor: colors.accent,
  },
  compactPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPlayButtonSent: {
    backgroundColor: colors.text,
  },
  compactProgress: {
    flex: 1,
    height: 4,
    backgroundColor: withAlpha(colors.accent, '4D'),
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  compactDuration: {
    fontSize: 12,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
  },
  compactDurationSent: {
    color: colors.textSecondary,
  },
});

export default VoiceMessagePlayer;

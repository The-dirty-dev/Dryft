import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useVerificationSession,
  useFaceDetection,
  useChallengeDetection,
  useCameraForVerification,
  useLivenessDetection,
} from '../../hooks/useLivenessDetection';
import { livenessDetectionService } from '../../services/livenessDetection';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VerificationScreenProps {
  onComplete: (success: boolean) => void;
  onCancel: () => void;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  onComplete,
  onCancel,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    session,
    currentChallenge,
    completedCount,
    totalChallenges,
    progress,
    isComplete,
    isStarting,
    isSubmitting,
    error,
    startSession,
    cancelSession,
    submitVerification,
    clearError,
  } = useVerificationSession();

  const { cameraRef, hasPermission, isCameraReady, onCameraReady, takePicture } =
    useCameraForVerification();

  const { faceResult, detectFace } = useFaceDetection();
  const [countdown, setCountdown] = useState<number | null>(null);
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Handle challenge detection
  const handleChallengeComplete = useCallback(async () => {
    if (!currentChallenge) return;

    const photoUri = await takePicture();
    if (photoUri) {
      await livenessDetectionService.completeChallenge(currentChallenge.id, photoUri);
    }
  }, [currentChallenge, takePicture]);

  const { isDetected, confidence, checkChallenge } = useChallengeDetection(
    currentChallenge?.type || null,
    handleChallengeComplete
  );

  // Start session on mount
  useEffect(() => {
    startSession();
  }, [startSession]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Pulse animation for face guide
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Countdown timer for each challenge
  useEffect(() => {
    if (!currentChallenge || isDetected) return;

    setCountdown(currentChallenge.duration);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentChallenge?.id, isDetected]);

  // Continuous face detection
  useEffect(() => {
    if (!isCameraReady || !currentChallenge || isDetected) return;

    const interval = setInterval(async () => {
      const photoUri = await takePicture();
      if (photoUri) {
        const result = await detectFace(photoUri);
        if (result) {
          checkChallenge(result);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isCameraReady, currentChallenge, isDetected, takePicture, detectFace, checkChallenge]);

  // Submit when all challenges complete
  useEffect(() => {
    if (isComplete && !isSubmitting) {
      submitVerification().then((result) => {
        onComplete(result.success);
      });
    }
  }, [isComplete, isSubmitting, submitVerification, onComplete]);

  const handleCancel = () => {
    cancelSession();
    onCancel();
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera" size={64} color={colors.textMuted} />
        <Text style={styles.errorTitle}>Camera Access Required</Text>
        <Text style={styles.errorText}>
          Please enable camera access in your device settings to verify your profile.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isStarting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Setting up verification...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="warning" size={64} color={colors.error} />
        <Text style={styles.errorTitle}>Verification Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            clearError();
            startSession();
          }}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isSubmitting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Verifying your identity...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={CameraType.front}
        onCameraReady={onCameraReady}
      >
        <LinearGradient
          colors={[colors.overlay, 'transparent', 'transparent', colors.overlay]}
          style={styles.overlay}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {completedCount}/{totalChallenges}
              </Text>
            </View>
          </View>

          {/* Face Guide */}
          <View style={styles.faceGuideContainer}>
            <Animated.View
              style={[
                styles.faceGuide,
                {
                  transform: [{ scale: pulseAnim }],
                  borderColor: faceResult?.detected ? colors.success : colors.accent,
                },
              ]}
            >
              {faceResult?.detected && (
                <View style={styles.faceDetectedIndicator}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                </View>
              )}
            </Animated.View>
          </View>

          {/* Challenge Instructions */}
          {currentChallenge && (
            <View style={styles.challengeContainer}>
              <View style={styles.challengeHeader}>
                <Ionicons
                  name={livenessDetectionService.getChallengeIcon(currentChallenge.type) as any}
                  size={32}
                  color={colors.accent}
                />
                {countdown !== null && (
                  <View style={styles.countdownContainer}>
                    <Text style={styles.countdownText}>{countdown}s</Text>
                  </View>
                )}
              </View>
              <Text style={styles.challengeInstruction}>
                {currentChallenge.instruction}
              </Text>

              {/* Confidence indicator */}
              <View style={styles.confidenceContainer}>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      { width: `${confidence * 100}%` },
                    ]}
                  />
                </View>
              </View>

              {isDetected && (
                <View style={styles.detectedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.detectedText}>Detected!</Text>
                </View>
              )}
            </View>
          )}

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipText}>
              {faceResult?.detected
                ? 'Face detected. Follow the instructions above.'
                : 'Position your face in the circle'}
            </Text>
          </View>
        </LinearGradient>
      </Camera>
    </View>
  );
};

// ============================================================================
// Verification Badge Component
// ============================================================================

interface VerificationBadgeProps {
  type: 'verified' | 'verified_plus' | 'trusted';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  type,
  size = 'medium',
  showLabel = false,
}) => {
  const colors = useColors();
  const badgeStyles = useMemo(() => createBadgeStyles(), []);
  const badgeColors: Record<VerificationBadgeProps['type'], string> = {
    verified: colors.info,
    verified_plus: colors.accent,
    trusted: colors.success,
  };

  const icons = {
    verified: 'checkmark-circle',
    verified_plus: 'shield-checkmark',
    trusted: 'star',
  };

  const labels = {
    verified: 'Verified',
    verified_plus: 'Verified+',
    trusted: 'Trusted',
  };

  const sizes = {
    small: 16,
    medium: 20,
    large: 28,
  };

  return (
    <View style={badgeStyles.container}>
      <View
        style={[
          badgeStyles.badge,
          { backgroundColor: withAlpha(badgeColors[type], '33') },
        ]}
      >
        <Ionicons
          name={icons[type] as any}
          size={sizes[size]}
          color={badgeColors[type]}
        />
        {showLabel && (
          <Text style={[badgeStyles.label, { color: badgeColors[type] }]}>
            {labels[type]}
          </Text>
        )}
      </View>
    </View>
  );
};

// ============================================================================
// Verification Prompt Component
// ============================================================================

interface VerificationPromptProps {
  onStartVerification: () => void;
  onDismiss?: () => void;
}

export const VerificationPrompt: React.FC<VerificationPromptProps> = ({
  onStartVerification,
  onDismiss,
}) => {
  const { status } = useLivenessDetection();
  const colors = useColors();
  const promptStyles = useMemo(() => createPromptStyles(colors), [colors]);

  if (status === 'verified') return null;

  return (
    <View style={promptStyles.container}>
      <LinearGradient
        colors={[colors.accent, colors.accentSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={promptStyles.gradient}
      >
        <View style={promptStyles.content}>
          <Ionicons name="shield-checkmark" size={32} color={colors.text} />
          <View style={promptStyles.textContainer}>
            <Text style={promptStyles.title}>Get Verified</Text>
            <Text style={promptStyles.subtitle}>
              Verify your identity to get the trusted badge
            </Text>
          </View>
        </View>
        <View style={promptStyles.buttons}>
          <TouchableOpacity
            style={promptStyles.verifyButton}
            onPress={onStartVerification}
          >
            <Text style={promptStyles.verifyButtonText}>Verify Now</Text>
          </TouchableOpacity>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss}>
              <Text style={promptStyles.dismissText}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDarkest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withAlpha(colors.background, '80'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBackground: {
    flex: 1,
    height: 4,
    backgroundColor: withAlpha(colors.text, '33'),
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressText: {
    color: colors.text,
    fontSize: 14,
    marginLeft: 12,
    fontWeight: '600',
  },
  faceGuideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.35,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  faceDetectedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  challengeContainer: {
    alignItems: 'center',
    backgroundColor: withAlpha(colors.background, 'B3'),
    borderRadius: 16,
    padding: 20,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownContainer: {
    marginLeft: 12,
    backgroundColor: withAlpha(colors.accent, '4D'),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countdownText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  challengeInstruction: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  confidenceContainer: {
    width: '100%',
    marginTop: 16,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: withAlpha(colors.text, '33'),
    borderRadius: 2,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  detectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: withAlpha(colors.success, '33'),
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detectedText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tipsContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  tipText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    color: colors.text,
    fontSize: 16,
    marginTop: 16,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 40,
  },
  button: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});

const createBadgeStyles = () => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

const createPromptStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.text,
    fontSize: 13,
    marginTop: 2,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  verifyButton: {
    backgroundColor: colors.text,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  verifyButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  dismissText: {
    color: colors.text,
    fontSize: 14,
    marginLeft: 16,
  },
});

export default VerificationScreen;

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { useVerificationStore } from '../../store/verificationStore';
import { AccessibleButton } from '../../components/AccessibleComponents';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

type PoseType = 'front' | 'left' | 'right' | 'smile';

interface PoseInstruction {
  type: PoseType;
  title: string;
  description: string;
  icon: string;
}

const POSES: PoseInstruction[] = [
  {
    type: 'front',
    title: 'Look Straight',
    description: 'Face the camera directly with a neutral expression',
    icon: 'person',
  },
  {
    type: 'smile',
    title: 'Smile',
    description: 'Give us your best smile!',
    icon: 'happy',
  },
  {
    type: 'left',
    title: 'Turn Left',
    description: 'Turn your head slightly to the left',
    icon: 'arrow-back',
  },
  {
    type: 'right',
    title: 'Turn Right',
    description: 'Turn your head slightly to the right',
    icon: 'arrow-forward',
  },
];

export default function PhotoVerificationScreen({ navigation }: any) {
  const { t } = useTranslation();
  const theme = useTheme();
  const cameraRef = useRef<Camera>(null);

  const { submitPhotoVerification, isLoading, error, clearError } = useVerificationStore();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<PoseType, string | null>>({
    front: null,
    left: null,
    right: null,
    smile: null,
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const currentPose = POSES[currentPoseIndex];

  // Request camera permission
  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      setCapturedPhotos((prev) => ({
        ...prev,
        [currentPose.type]: photo.uri,
      }));

      // Move to next pose or show review
      if (currentPoseIndex < POSES.length - 1) {
        setCurrentPoseIndex(currentPoseIndex + 1);
      } else {
        setShowReview(true);
      }
    } catch (err) {
      Alert.alert(t('alerts.title.error'), t('alerts.verification.captureFailed'));
    }
    setIsCapturing(false);
  }, [currentPoseIndex, currentPose, isCapturing]);

  const retakePhoto = useCallback((poseType: PoseType) => {
    setCapturedPhotos((prev) => ({
      ...prev,
      [poseType]: null,
    }));
    const poseIndex = POSES.findIndex((p) => p.type === poseType);
    setCurrentPoseIndex(poseIndex);
    setShowReview(false);
  }, []);

  const submitVerification = useCallback(async () => {
    // Submit the front-facing photo as the primary verification
    const primaryPhoto = capturedPhotos.front;
    if (!primaryPhoto) {
      Alert.alert(t('alerts.title.error'), t('alerts.verification.frontPhotoRequired'));
      return;
    }

    const success = await submitPhotoVerification(primaryPhoto, 'selfie');
    if (success) {
      Alert.alert(
        t('verification.submitted'),
        t('verification.reviewMessage'),
        [{ text: t('alerts.actions.ok'), onPress: () => navigation.goBack() }]
      );
    } else if (error) {
      Alert.alert(t('alerts.title.error'), error || t('alerts.verification.unexpectedError'));
      clearError();
    }
  }, [capturedPhotos, submitPhotoVerification, navigation, t, error, clearError]);

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>
            Camera Access Required
          </Text>
          <Text style={[styles.permissionText, { color: theme.colors.textSecondary }]}>
            We need camera access to verify your identity. Please enable it in your device settings.
          </Text>
          <AccessibleButton
            label="Go Back"
            onPress={() => navigation.goBack()}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: theme.colors.text }]}>Go Back</Text>
          </AccessibleButton>
        </View>
      </SafeAreaView>
    );
  }

  if (showReview) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Review Photos
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.reviewContainer}>
          <Text style={[styles.reviewTitle, { color: theme.colors.text }]}>
            Review Your Verification Photos
          </Text>
          <Text style={[styles.reviewSubtitle, { color: theme.colors.textSecondary }]}>
            Make sure your face is clearly visible in each photo
          </Text>

          <View style={styles.photoGrid}>
            {POSES.map((pose) => (
              <View key={pose.type} style={styles.photoItem}>
                <Image
                  source={{ uri: capturedPhotos[pose.type] || undefined }}
                  style={[styles.reviewPhoto, { backgroundColor: theme.colors.surfaceElevated }]}
                />
                <Text style={[styles.photoLabel, { color: theme.colors.textSecondary }]}>
                  {pose.title}
                </Text>
                <TouchableOpacity
                  onPress={() => retakePhoto(pose.type)}
                  style={styles.retakeButton}
                >
                  <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                  <Text style={[styles.retakeText, { color: theme.colors.primary }]}>
                    Retake
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.submitContainer}>
            <AccessibleButton
              label="Submit for Verification"
              onPress={submitVerification}
              disabled={isLoading}
              style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <Text style={[styles.submitButtonText, { color: theme.colors.text }]}>
                  Submit for Verification
                </Text>
              )}
            </AccessibleButton>

            <Text style={[styles.disclaimer, { color: theme.colors.textMuted }]}>
              Your photos will be reviewed by our team within 24 hours. We use secure
              encryption and never share your verification photos.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Photo Verification
        </Text>
        <Text style={[styles.stepIndicator, { color: theme.colors.textSecondary }]}>
          {currentPoseIndex + 1}/{POSES.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        {POSES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              {
                backgroundColor:
                  index <= currentPoseIndex
                    ? theme.colors.primary
                    : theme.colors.border,
              },
            ]}
          />
        ))}
      </View>

      {/* Camera view */}
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={CameraType.front}
          ratio="4:3"
        >
          {/* Face outline guide */}
          <View style={styles.faceGuide}>
            <View style={[styles.faceOutline, { borderColor: theme.colors.primary }]} />
          </View>
        </Camera>
      </View>

      {/* Pose instructions */}
      <View style={[styles.instructionContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.instructionIcon, { backgroundColor: withAlpha(theme.colors.primary, '1A') }]}>
          <Ionicons
            name={currentPose.icon as any}
            size={32}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.instructionText}>
          <Text style={[styles.instructionTitle, { color: theme.colors.text }]}>
            {currentPose.title}
          </Text>
          <Text style={[styles.instructionDescription, { color: theme.colors.textSecondary }]}>
            {currentPose.description}
          </Text>
        </View>
      </View>

      {/* Capture button */}
      <View style={styles.captureContainer}>
        <TouchableOpacity
          onPress={capturePhoto}
          disabled={isCapturing}
          style={[
            styles.captureButton,
            { borderColor: theme.colors.primary },
            isCapturing && styles.captureButtonDisabled,
          ]}
          accessible={true}
          accessibilityLabel="Take photo"
          accessibilityRole="button"
        >
          <View style={[styles.captureButtonInner, { backgroundColor: theme.colors.primary }]} />
        </TouchableOpacity>
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={[styles.tipsTitle, { color: theme.colors.textSecondary }]}>
          Tips for best results:
        </Text>
        <Text style={[styles.tipText, { color: theme.colors.textMuted }]}>
          • Good lighting on your face
        </Text>
        <Text style={[styles.tipText, { color: theme.colors.textMuted }]}>
          • Remove sunglasses and hats
        </Text>
        <Text style={[styles.tipText, { color: theme.colors.textMuted }]}>
          • Keep your face in the circle
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  stepIndicator: {
    fontSize: 14,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  faceGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOutline: {
    width: 200,
    height: 260,
    borderRadius: 100,
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  instructionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  instructionDescription: {
    fontSize: 14,
  },
  captureContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  tipsContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    marginBottom: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewContainer: {
    flex: 1,
    padding: 16,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  reviewSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoItem: {
    width: '48%',
    marginBottom: 16,
  },
  reviewPhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
  },
  photoLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  retakeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  retakeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  submitContainer: {
    marginTop: 'auto',
    paddingVertical: 16,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});

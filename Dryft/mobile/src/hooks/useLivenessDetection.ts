import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera } from 'expo-camera';
import {
  livenessDetectionService,
  VerificationStatus,
  VerificationSession,
  VerificationResult,
  VerificationBadge,
  LivenessChallenge,
  FaceDetectionResult,
  ChallengeType,
} from '../services/livenessDetection';

// ============================================================================
// useLivenessDetection - Main verification hook
// ============================================================================

/**
 * React hook `useLivenessDetection`.
 * @returns Hook state and actions.
 * @example
 * const value = useLivenessDetection();
 */
export function useLivenessDetection() {
  const [status, setStatus] = useState<VerificationStatus>(
    livenessDetectionService.getVerificationStatus()
  );
  const [badge, setBadge] = useState<VerificationBadge | null>(
    livenessDetectionService.getVerificationBadge()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = livenessDetectionService.subscribe(() => {
      setStatus(livenessDetectionService.getVerificationStatus());
      setBadge(livenessDetectionService.getVerificationBadge());
    });

    return unsubscribe;
  }, []);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      await livenessDetectionService.refreshStatus();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    status,
    badge,
    isVerified: status === 'verified',
    isPending: status === 'pending',
    isExpired: status === 'expired',
    isLoading,
    refreshStatus,
  };
}

// ============================================================================
// useVerificationSession - Active session management
// ============================================================================

/**
 * React hook `useVerificationSession`.
 * @returns Hook state and actions.
 * @example
 * const value = useVerificationSession();
 */
export function useVerificationSession() {
  const [session, setSession] = useState<VerificationSession | null>(
    livenessDetectionService.getCurrentSession()
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = livenessDetectionService.subscribe(() => {
      setSession(livenessDetectionService.getCurrentSession());
    });

    return unsubscribe;
  }, []);

  const startSession = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      const newSession = await livenessDetectionService.startVerificationSession();
      if (!newSession) {
        setError('Failed to start verification. Please check camera permissions.');
      }
      return newSession;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const cancelSession = useCallback(async () => {
    await livenessDetectionService.cancelSession();
    setError(null);
  }, []);

  const submitVerification = useCallback(async (): Promise<VerificationResult> => {
    setIsSubmitting(true);
    try {
      const result = await livenessDetectionService.submitVerification();
      if (!result.success && result.failureReason) {
        setError(result.failureReason);
      }
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const currentChallenge = session?.challenges.find(
    (c) => !session.completedChallenges.includes(c.id)
  );

  const progress = session
    ? session.completedChallenges.length / session.challenges.length
    : 0;

  const isComplete = session
    ? session.completedChallenges.length === session.challenges.length
    : false;

  return {
    session,
    currentChallenge,
    completedCount: session?.completedChallenges.length || 0,
    totalChallenges: session?.challenges.length || 0,
    progress,
    isComplete,
    isStarting,
    isSubmitting,
    error,
    startSession,
    cancelSession,
    submitVerification,
    clearError: () => setError(null),
  };
}

// ============================================================================
// useFaceDetection - Real-time face detection
// ============================================================================

/**
 * React hook `useFaceDetection`.
 * @returns Hook state and actions.
 * @example
 * const value = useFaceDetection();
 */
export function useFaceDetection() {
  const [faceResult, setFaceResult] = useState<FaceDetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const detectionRef = useRef<boolean>(false);

  const detectFace = useCallback(async (imageUri: string) => {
    if (detectionRef.current) return null;

    detectionRef.current = true;
    setIsDetecting(true);

    try {
      const result = await livenessDetectionService.detectFace(imageUri);
      setFaceResult(result);
      return result;
    } finally {
      setIsDetecting(false);
      detectionRef.current = false;
    }
  }, []);

  const resetDetection = useCallback(() => {
    setFaceResult(null);
  }, []);

  return {
    faceResult,
    isDetecting,
    isFaceDetected: faceResult?.detected || false,
    faceCount: faceResult?.faceCount || 0,
    detectFace,
    resetDetection,
  };
}

// ============================================================================
// useChallengeDetection - Detect challenge completion
// ============================================================================

export function useChallengeDetection(
  challengeType: ChallengeType | null,
  onChallengeComplete?: () => void
) {
  const [isDetected, setIsDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const detectionCountRef = useRef(0);
  const requiredDetections = 3; // Require multiple consistent detections

  const checkChallenge = useCallback(
    (faceResult: FaceDetectionResult) => {
      if (!challengeType || isDetected) return;

      const detected = livenessDetectionService.detectChallenge(
        challengeType,
        faceResult
      );

      if (detected) {
        detectionCountRef.current++;
        setConfidence(detectionCountRef.current / requiredDetections);

        if (detectionCountRef.current >= requiredDetections) {
          setIsDetected(true);
          onChallengeComplete?.();
        }
      }
    },
    [challengeType, isDetected, onChallengeComplete]
  );

  const resetChallenge = useCallback(() => {
    setIsDetected(false);
    setConfidence(0);
    detectionCountRef.current = 0;
  }, []);

  // Reset when challenge type changes
  useEffect(() => {
    resetChallenge();
  }, [challengeType, resetChallenge]);

  return {
    isDetected,
    confidence,
    checkChallenge,
    resetChallenge,
  };
}

// ============================================================================
// useCameraForVerification - Camera setup for verification
// ============================================================================

/**
 * React hook `useCameraForVerification`.
 * @returns Hook state and actions.
 * @example
 * const value = useCameraForVerification();
 */
export function useCameraForVerification() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef<Camera | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const onCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady) return null;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: true,
      });
      return photo.uri;
    } catch (error) {
      console.error('Failed to take picture:', error);
      return null;
    }
  }, [isCameraReady]);

  return {
    cameraRef,
    hasPermission,
    isCameraReady,
    onCameraReady,
    takePicture,
  };
}

// ============================================================================
// usePhotoVerification - Fallback photo verification
// ============================================================================

/**
 * React hook `usePhotoVerification`.
 * @returns Hook state and actions.
 * @example
 * const value = usePhotoVerification();
 */
export function usePhotoVerification() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const submitPhoto = useCallback(async (photoUri: string) => {
    setIsSubmitting(true);
    try {
      const verificationResult =
        await livenessDetectionService.submitPhotoVerification(photoUri);
      setResult(verificationResult);
      return verificationResult;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  return {
    isSubmitting,
    result,
    submitPhoto,
    reset,
  };
}

// ============================================================================
// useIDVerification - ID + selfie verification
// ============================================================================

/**
 * React hook `useIDVerification`.
 * @returns Hook state and actions.
 * @example
 * const value = useIDVerification();
 */
export function useIDVerification() {
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [step, setStep] = useState<'id' | 'selfie' | 'review'>('id');

  const setID = useCallback((uri: string) => {
    setIdPhoto(uri);
    setStep('selfie');
  }, []);

  const setSelfie = useCallback((uri: string) => {
    setSelfiePhoto(uri);
    setStep('review');
  }, []);

  const submit = useCallback(async () => {
    if (!idPhoto || !selfiePhoto) return null;

    setIsSubmitting(true);
    try {
      const verificationResult = await livenessDetectionService.submitIDVerification(
        idPhoto,
        selfiePhoto
      );
      setResult(verificationResult);
      return verificationResult;
    } finally {
      setIsSubmitting(false);
    }
  }, [idPhoto, selfiePhoto]);

  const reset = useCallback(() => {
    setIdPhoto(null);
    setSelfiePhoto(null);
    setResult(null);
    setStep('id');
  }, []);

  return {
    idPhoto,
    selfiePhoto,
    step,
    isSubmitting,
    result,
    isReady: !!idPhoto && !!selfiePhoto,
    setID,
    setSelfie,
    submit,
    reset,
    goBack: () => setStep(step === 'review' ? 'selfie' : 'id'),
  };
}

// ============================================================================
// useVerificationHistory - Past verification attempts
// ============================================================================

/**
 * React hook `useVerificationHistory`.
 * @returns Hook state and actions.
 * @example
 * const value = useVerificationHistory();
 */
export function useVerificationHistory() {
  const [history, setHistory] = useState(livenessDetectionService.getHistory());

  useEffect(() => {
    const unsubscribe = livenessDetectionService.subscribe(() => {
      setHistory(livenessDetectionService.getHistory());
    });

    return unsubscribe;
  }, []);

  return {
    history,
    lastAttempt: history[0] || null,
    attemptCount: history.length,
    successCount: history.filter((h) => h.status === 'verified').length,
    failureCount: history.filter((h) => h.status === 'failed').length,
  };
}

// ============================================================================
// useVerificationBadge - Badge display
// ============================================================================

/**
 * React hook `useVerificationBadge`.
 * @returns Hook state and actions.
 * @example
 * const value = useVerificationBadge();
 */
export function useVerificationBadge() {
  const [badge, setBadge] = useState(livenessDetectionService.getVerificationBadge());

  useEffect(() => {
    const unsubscribe = livenessDetectionService.subscribe(() => {
      setBadge(livenessDetectionService.getVerificationBadge());
    });

    return unsubscribe;
  }, []);

  const getBadgeLabel = useCallback((type: VerificationBadge['type']) => {
    const labels: Record<VerificationBadge['type'], string> = {
      verified: 'Verified',
      verified_plus: 'Verified+',
      trusted: 'Trusted',
    };
    return labels[type];
  }, []);

  const getBadgeColor = useCallback((type: VerificationBadge['type']) => {
    const colors: Record<VerificationBadge['type'], string> = {
      verified: '#3B82F6', // Blue
      verified_plus: '#8B5CF6', // Purple
      trusted: '#10B981', // Green
    };
    return colors[type];
  }, []);

  const getBadgeIcon = useCallback((type: VerificationBadge['type']) => {
    const icons: Record<VerificationBadge['type'], string> = {
      verified: 'checkmark-circle',
      verified_plus: 'shield-checkmark',
      trusted: 'star',
    };
    return icons[type];
  }, []);

  return {
    badge,
    hasBadge: !!badge,
    badgeLabel: badge ? getBadgeLabel(badge.type) : null,
    badgeColor: badge ? getBadgeColor(badge.type) : null,
    badgeIcon: badge ? getBadgeIcon(badge.type) : null,
    isExpired: badge?.expiresAt
      ? new Date(badge.expiresAt) < new Date()
      : false,
  };
}

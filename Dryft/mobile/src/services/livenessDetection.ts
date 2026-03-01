import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FaceDetector from 'expo-face-detector';
import * as FileSystem from 'expo-file-system';
import { api } from './api';
import { trackEvent } from './analytics';

/**
 * Liveness and verification workflows: face detection, challenges, and uploads.
 * Wraps camera/photo flows and submits verification requests to the backend.
 * @example
 * const session = await startLivenessSession();
 */
// ============================================================================
// Types
// ============================================================================

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'expired';

export type ChallengeType =
  | 'blink'
  | 'smile'
  | 'turn_left'
  | 'turn_right'
  | 'nod'
  | 'raise_eyebrows';

export interface LivenessChallenge {
  id: string;
  type: ChallengeType;
  instruction: string;
  duration: number; // seconds to complete
  order: number;
}

export interface FaceDetectionResult {
  detected: boolean;
  faceCount: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    nose?: { x: number; y: number };
    leftMouth?: { x: number; y: number };
    rightMouth?: { x: number; y: number };
  };
  rollAngle?: number;
  yawAngle?: number;
  smilingProbability?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
}

export interface VerificationSession {
  id: string;
  status: 'active' | 'completed' | 'failed' | 'expired';
  challenges: LivenessChallenge[];
  completedChallenges: string[];
  startedAt: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
}

export interface VerificationResult {
  success: boolean;
  status: VerificationStatus;
  verifiedAt?: string;
  expiresAt?: string;
  confidence?: number;
  failureReason?: string;
  badge?: VerificationBadge;
}

export interface VerificationBadge {
  type: 'verified' | 'verified_plus' | 'trusted';
  awardedAt: string;
  expiresAt?: string;
}

export interface VerificationHistory {
  id: string;
  status: VerificationStatus;
  attemptedAt: string;
  completedAt?: string;
  failureReason?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  VERIFICATION_STATUS: 'dryft_verification_status',
  VERIFICATION_HISTORY: 'dryft_verification_history',
  LAST_VERIFICATION: 'dryft_last_verification',
};

const CHALLENGE_INSTRUCTIONS: Record<ChallengeType, string> = {
  blink: 'Blink your eyes slowly',
  smile: 'Give us a big smile',
  turn_left: 'Turn your head to the left',
  turn_right: 'Turn your head to the right',
  nod: 'Nod your head up and down',
  raise_eyebrows: 'Raise your eyebrows',
};

const CHALLENGE_DURATION = 5; // seconds per challenge

const DETECTION_THRESHOLDS = {
  blink: 0.3, // Eye open probability below this = blink
  smile: 0.7, // Smiling probability above this = smile
  turn: 15, // Yaw angle in degrees for turn detection
  nod: 10, // Roll angle change for nod detection
  eyebrows: 0.8, // Combined probability for raised eyebrows
};

// ============================================================================
// Liveness Detection Service
// ============================================================================

class LivenessDetectionService {
  private static instance: LivenessDetectionService;
  private verificationStatus: VerificationStatus = 'unverified';
  private currentSession: VerificationSession | null = null;
  private verificationBadge: VerificationBadge | null = null;
  private history: VerificationHistory[] = [];
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  // Tracking for challenge detection
  private baselineYaw: number | null = null;
  private baselineRoll: number | null = null;
  private blinkDetected = false;
  private smileDetected = false;

  private constructor() {}

  static getInstance(): LivenessDetectionService {
    if (!LivenessDetectionService.instance) {
      LivenessDetectionService.instance = new LivenessDetectionService();
    }
    return LivenessDetectionService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadVerificationStatus(),
      this.loadHistory(),
    ]);

    this.initialized = true;
    console.log('[LivenessDetection] Initialized');
  }

  private async loadVerificationStatus(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.VERIFICATION_STATUS);
      if (stored) {
        const data = JSON.parse(stored);
        this.verificationStatus = data.status;
        this.verificationBadge = data.badge || null;

        // Check if verification has expired
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          this.verificationStatus = 'expired';
          this.verificationBadge = null;
        }
      }
    } catch (error) {
      console.error('[LivenessDetection] Failed to load status:', error);
    }
  }

  private async saveVerificationStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.VERIFICATION_STATUS,
        JSON.stringify({
          status: this.verificationStatus,
          badge: this.verificationBadge,
        })
      );
    } catch (error) {
      console.error('[LivenessDetection] Failed to save status:', error);
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.VERIFICATION_HISTORY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[LivenessDetection] Failed to load history:', error);
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.VERIFICATION_HISTORY,
        JSON.stringify(this.history)
      );
    } catch (error) {
      console.error('[LivenessDetection] Failed to save history:', error);
    }
  }

  // ==========================================================================
  // Verification Session
  // ==========================================================================

  async startVerificationSession(): Promise<VerificationSession | null> {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      // Get challenges from server
      const response = await api.post<{
        session_id: string;
        challenges: Array<{
          id: string;
          type: ChallengeType;
          order: number;
        }>;
        expires_at: string;
        max_attempts: number;
      }>('/v1/verification/start');

      const challenges: LivenessChallenge[] = response.data!.challenges.map((c) => ({
        id: c.id,
        type: c.type,
        instruction: CHALLENGE_INSTRUCTIONS[c.type],
        duration: CHALLENGE_DURATION,
        order: c.order,
      }));

      this.currentSession = {
        id: response.data!.session_id,
        status: 'active',
        challenges: challenges.sort((a, b) => a.order - b.order),
        completedChallenges: [],
        startedAt: new Date().toISOString(),
        expiresAt: response.data!.expires_at,
        attempts: 0,
        maxAttempts: response.data!.max_attempts,
      };

      // Reset detection state
      this.resetDetectionState();

      trackEvent('verification_session_started');

      this.notifyListeners();

      return this.currentSession;
    } catch (error) {
      console.error('[LivenessDetection] Failed to start session:', error);
      return null;
    }
  }

  private resetDetectionState(): void {
    this.baselineYaw = null;
    this.baselineRoll = null;
    this.blinkDetected = false;
    this.smileDetected = false;
  }

  getCurrentSession(): VerificationSession | null {
    return this.currentSession;
  }

  async cancelSession(): Promise<void> {
    if (this.currentSession) {
      try {
        await api.post('/v1/verification/cancel', {
          session_id: this.currentSession.id,
        });
      } catch (error) {
        // Ignore errors
      }

      this.currentSession = null;
      this.resetDetectionState();
      this.notifyListeners();
    }
  }

  // ==========================================================================
  // Face Detection
  // ==========================================================================

  async detectFace(imageUri: string): Promise<FaceDetectionResult> {
    try {
      const result = await FaceDetector.detectFacesAsync(imageUri, {
        mode: FaceDetector.FaceDetectorMode.accurate,
        detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
        runClassifications: FaceDetector.FaceDetectorClassifications.all,
      });

      if (result.faces.length === 0) {
        return { detected: false, faceCount: 0 };
      }

      const face = result.faces[0];

      return {
        detected: true,
        faceCount: result.faces.length,
        bounds: face.bounds,
        landmarks: {
          leftEye: face.leftEyePosition,
          rightEye: face.rightEyePosition,
          nose: face.noseBasePosition,
          leftMouth: face.leftMouthPosition,
          rightMouth: face.rightMouthPosition,
        },
        rollAngle: face.rollAngle,
        yawAngle: face.yawAngle,
        smilingProbability: face.smilingProbability,
        leftEyeOpenProbability: face.leftEyeOpenProbability,
        rightEyeOpenProbability: face.rightEyeOpenProbability,
      };
    } catch (error) {
      console.error('[LivenessDetection] Face detection failed:', error);
      return { detected: false, faceCount: 0 };
    }
  }

  // ==========================================================================
  // Challenge Detection
  // ==========================================================================

  detectChallenge(
    challengeType: ChallengeType,
    faceResult: FaceDetectionResult
  ): boolean {
    if (!faceResult.detected) return false;

    switch (challengeType) {
      case 'blink':
        return this.detectBlink(faceResult);
      case 'smile':
        return this.detectSmile(faceResult);
      case 'turn_left':
        return this.detectTurnLeft(faceResult);
      case 'turn_right':
        return this.detectTurnRight(faceResult);
      case 'nod':
        return this.detectNod(faceResult);
      case 'raise_eyebrows':
        return this.detectRaisedEyebrows(faceResult);
      default:
        return false;
    }
  }

  private detectBlink(faceResult: FaceDetectionResult): boolean {
    const leftEye = faceResult.leftEyeOpenProbability ?? 1;
    const rightEye = faceResult.rightEyeOpenProbability ?? 1;
    const avgEyeOpen = (leftEye + rightEye) / 2;

    // Detect blink: eyes were open, now closed
    if (avgEyeOpen < DETECTION_THRESHOLDS.blink) {
      this.blinkDetected = true;
    }

    // Return true when eyes reopen after blink
    if (this.blinkDetected && avgEyeOpen > 0.7) {
      return true;
    }

    return false;
  }

  private detectSmile(faceResult: FaceDetectionResult): boolean {
    const smileProbability = faceResult.smilingProbability ?? 0;

    if (smileProbability >= DETECTION_THRESHOLDS.smile) {
      this.smileDetected = true;
      return true;
    }

    return false;
  }

  private detectTurnLeft(faceResult: FaceDetectionResult): boolean {
    const yaw = faceResult.yawAngle ?? 0;

    // Set baseline on first detection
    if (this.baselineYaw === null) {
      this.baselineYaw = yaw;
      return false;
    }

    // Detect left turn (negative yaw)
    return yaw < this.baselineYaw - DETECTION_THRESHOLDS.turn;
  }

  private detectTurnRight(faceResult: FaceDetectionResult): boolean {
    const yaw = faceResult.yawAngle ?? 0;

    // Set baseline on first detection
    if (this.baselineYaw === null) {
      this.baselineYaw = yaw;
      return false;
    }

    // Detect right turn (positive yaw)
    return yaw > this.baselineYaw + DETECTION_THRESHOLDS.turn;
  }

  private detectNod(faceResult: FaceDetectionResult): boolean {
    const roll = faceResult.rollAngle ?? 0;

    // Set baseline on first detection
    if (this.baselineRoll === null) {
      this.baselineRoll = roll;
      return false;
    }

    // Detect nod (significant roll change)
    return Math.abs(roll - this.baselineRoll) > DETECTION_THRESHOLDS.nod;
  }

  private detectRaisedEyebrows(faceResult: FaceDetectionResult): boolean {
    // This is approximated - raised eyebrows often correlate with wider eyes
    const leftEye = faceResult.leftEyeOpenProbability ?? 0;
    const rightEye = faceResult.rightEyeOpenProbability ?? 0;
    const avgEyeOpen = (leftEye + rightEye) / 2;

    return avgEyeOpen >= DETECTION_THRESHOLDS.eyebrows;
  }

  // ==========================================================================
  // Challenge Completion
  // ==========================================================================

  async completeChallenge(
    challengeId: string,
    videoUri: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      // Upload video frame for server-side verification
      const base64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await api.post<{ success: boolean; error?: string }>(
        '/v1/verification/challenge/complete',
        {
          session_id: this.currentSession.id,
          challenge_id: challengeId,
          video_data: base64,
        }
      );

      if (response.data!.success) {
        this.currentSession.completedChallenges.push(challengeId);
        this.resetDetectionState();
        this.notifyListeners();
      }

      return response.data;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async submitVerification(): Promise<VerificationResult> {
    if (!this.currentSession) {
      return {
        success: false,
        status: 'failed',
        failureReason: 'No active session',
      };
    }

    try {
      const response = await api.post<{
        success: boolean;
        status: VerificationStatus;
        verified_at?: string;
        expires_at?: string;
        confidence?: number;
        failure_reason?: string;
        badge?: {
          type: 'verified' | 'verified_plus' | 'trusted';
          awarded_at: string;
          expires_at?: string;
        };
      }>('/v1/verification/submit', {
        session_id: this.currentSession.id,
      });

      const result: VerificationResult = {
        success: response.data!.success,
        status: response.data!.status,
        verifiedAt: response.data!.verified_at,
        expiresAt: response.data!.expires_at,
        confidence: response.data!.confidence,
        failureReason: response.data!.failure_reason,
      };

      if (response.data!.badge) {
        result.badge = {
          type: response.data!.badge.type,
          awardedAt: response.data!.badge.awarded_at,
          expiresAt: response.data!.badge.expires_at,
        };
        this.verificationBadge = result.badge;
      }

      // Update status
      this.verificationStatus = response.data!.status;
      await this.saveVerificationStatus();

      // Add to history
      this.history.unshift({
        id: this.currentSession.id,
        status: response.data!.status,
        attemptedAt: this.currentSession.startedAt,
        completedAt: new Date().toISOString(),
        failureReason: response.data!.failure_reason,
      });
      await this.saveHistory();

      // Clear session
      this.currentSession = null;

      trackEvent('verification_completed', {
        success: response.data!.success,
        status: response.data!.status,
        confidence: response.data!.confidence,
      });

      this.notifyListeners();

      return result;
    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        failureReason: error.message,
      };
    }
  }

  // ==========================================================================
  // Photo Verification (Fallback)
  // ==========================================================================

  async submitPhotoVerification(photoUri: string): Promise<VerificationResult> {
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await api.post<{
        success: boolean;
        status: VerificationStatus;
        failure_reason?: string;
      }>('/v1/verification/photo', {
        photo_data: base64,
      });

      if (response.data!.success) {
        this.verificationStatus = 'pending'; // Photo verification requires manual review
        await this.saveVerificationStatus();
      }

      trackEvent('photo_verification_submitted');

      this.notifyListeners();

      return {
        success: response.data!.success,
        status: response.data!.status,
        failureReason: response.data!.failure_reason,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        failureReason: error.message,
      };
    }
  }

  // ==========================================================================
  // ID Verification
  // ==========================================================================

  async submitIDVerification(
    idPhotoUri: string,
    selfieUri: string
  ): Promise<VerificationResult> {
    try {
      const [idBase64, selfieBase64] = await Promise.all([
        FileSystem.readAsStringAsync(idPhotoUri, {
          encoding: FileSystem.EncodingType.Base64,
        }),
        FileSystem.readAsStringAsync(selfieUri, {
          encoding: FileSystem.EncodingType.Base64,
        }),
      ]);

      const response = await api.post<{
        success: boolean;
        status: VerificationStatus;
        failure_reason?: string;
      }>('/v1/verification/id', {
        id_photo: idBase64,
        selfie_photo: selfieBase64,
      });

      if (response.data!.success) {
        this.verificationStatus = 'pending'; // ID verification requires review
        await this.saveVerificationStatus();
      }

      trackEvent('id_verification_submitted');

      this.notifyListeners();

      return {
        success: response.data!.success,
        status: response.data!.status,
        failureReason: response.data!.failure_reason,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        failureReason: error.message,
      };
    }
  }

  // ==========================================================================
  // Status & Getters
  // ==========================================================================

  getVerificationStatus(): VerificationStatus {
    return this.verificationStatus;
  }

  getVerificationBadge(): VerificationBadge | null {
    return this.verificationBadge;
  }

  isVerified(): boolean {
    return this.verificationStatus === 'verified';
  }

  getHistory(): VerificationHistory[] {
    return [...this.history];
  }

  async refreshStatus(): Promise<void> {
    try {
      const response = await api.get<{
        status: VerificationStatus;
        badge?: {
          type: 'verified' | 'verified_plus' | 'trusted';
          awarded_at: string;
          expires_at?: string;
        };
        verified_at?: string;
        expires_at?: string;
      }>('/v1/verification/status');

      this.verificationStatus = response.data!.status;

      if (response.data!.badge) {
        this.verificationBadge = {
          type: response.data!.badge.type,
          awardedAt: response.data!.badge.awarded_at,
          expiresAt: response.data!.badge.expires_at,
        };
      } else {
        this.verificationBadge = null;
      }

      await this.saveVerificationStatus();
      this.notifyListeners();
    } catch (error) {
      console.error('[LivenessDetection] Failed to refresh status:', error);
    }
  }

  // ==========================================================================
  // Challenge Helpers
  // ==========================================================================

  getChallengeIcon(type: ChallengeType): string {
    const icons: Record<ChallengeType, string> = {
      blink: 'eye-off',
      smile: 'happy',
      turn_left: 'arrow-back',
      turn_right: 'arrow-forward',
      nod: 'swap-vertical',
      raise_eyebrows: 'chevron-up',
    };
    return icons[type];
  }

  getChallengeDuration(): number {
    return CHALLENGE_DURATION;
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const livenessDetectionService = LivenessDetectionService.getInstance();
export default livenessDetectionService;

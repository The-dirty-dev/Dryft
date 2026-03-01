import {
  RekognitionClient,
  DetectFacesCommand,
  CompareFacesCommand,
  DetectFacesCommandOutput,
} from '@aws-sdk/client-rekognition';
import { v4 as uuid } from 'uuid';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// AWS Rekognition Client
// =============================================================================

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// =============================================================================
// Types
// =============================================================================

export interface VerificationSession {
  id: string;
  userId: string;
  challenges: Challenge[];
  completedChallenges: string[];
  selfieUrl?: string;
  idPhotoUrl?: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  order: number;
  completed: boolean;
  confidence?: number;
}

export type ChallengeType = 'blink' | 'smile' | 'turn_left' | 'turn_right' | 'nod' | 'neutral';

export interface FaceAnalysis {
  detected: boolean;
  confidence: number;
  boundingBox?: {
    width: number;
    height: number;
    left: number;
    top: number;
  };
  attributes?: {
    eyesOpen?: boolean;
    mouthOpen?: boolean;
    smile?: boolean;
    pose?: {
      pitch: number;
      roll: number;
      yaw: number;
    };
  };
}

export interface VerificationResult {
  success: boolean;
  confidence: number;
  reason?: string;
  faceMatch?: boolean;
  livenessScore?: number;
}

// =============================================================================
// In-Memory Session Store (Use Redis in production)
// =============================================================================

const sessions = new Map<string, VerificationSession>();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// =============================================================================
// Session Management
// =============================================================================

export function createSession(userId: string): VerificationSession {
  // Check for existing active session
  for (const [id, session] of sessions) {
    if (session.userId === userId && session.status === 'PENDING') {
      return session;
    }
  }

  const challengeTypes: ChallengeType[] = ['neutral', 'smile', 'blink'];
  const challenges: Challenge[] = challengeTypes.map((type, index) => ({
    id: uuid(),
    type,
    order: index,
    completed: false,
  }));

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  const session: VerificationSession = {
    id: uuid(),
    userId,
    challenges,
    completedChallenges: [],
    expiresAt,
    attempts: 0,
    maxAttempts: 5,
    status: 'PENDING',
  };

  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): VerificationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check expiration
  if (session.expiresAt < new Date()) {
    session.status = 'EXPIRED';
    return session;
  }

  return session;
}

export function updateSession(session: VerificationSession): void {
  sessions.set(session.id, session);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// =============================================================================
// Face Detection & Analysis
// =============================================================================

export async function analyzeFace(imageBuffer: Buffer): Promise<FaceAnalysis> {
  try {
    const command = new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['ALL'],
    });

    const response: DetectFacesCommandOutput = await rekognition.send(command);

    if (!response.FaceDetails || response.FaceDetails.length === 0) {
      return { detected: false, confidence: 0 };
    }

    const face = response.FaceDetails[0];

    return {
      detected: true,
      confidence: face.Confidence || 0,
      boundingBox: face.BoundingBox ? {
        width: face.BoundingBox.Width || 0,
        height: face.BoundingBox.Height || 0,
        left: face.BoundingBox.Left || 0,
        top: face.BoundingBox.Top || 0,
      } : undefined,
      attributes: {
        eyesOpen: face.EyesOpen?.Value,
        mouthOpen: face.MouthOpen?.Value,
        smile: face.Smile?.Value,
        pose: face.Pose ? {
          pitch: face.Pose.Pitch || 0,
          roll: face.Pose.Roll || 0,
          yaw: face.Pose.Yaw || 0,
        } : undefined,
      },
    };
  } catch (error) {
    logger.error('Face analysis failed:', error);
    throw new Error('Face analysis failed');
  }
}

// =============================================================================
// Challenge Verification
// =============================================================================

export async function verifyChallenge(
  session: VerificationSession,
  challengeId: string,
  imageBuffer: Buffer
): Promise<{ success: boolean; confidence: number; reason?: string }> {
  const challenge = session.challenges.find(c => c.id === challengeId);
  if (!challenge) {
    return { success: false, confidence: 0, reason: 'Invalid challenge' };
  }

  if (challenge.completed) {
    return { success: true, confidence: challenge.confidence || 0, reason: 'Already completed' };
  }

  session.attempts++;
  if (session.attempts > session.maxAttempts) {
    session.status = 'FAILED';
    updateSession(session);
    return { success: false, confidence: 0, reason: 'Max attempts exceeded' };
  }

  try {
    const analysis = await analyzeFace(imageBuffer);

    if (!analysis.detected) {
      return { success: false, confidence: 0, reason: 'No face detected' };
    }

    if (analysis.confidence < 90) {
      return { success: false, confidence: analysis.confidence, reason: 'Low confidence face detection' };
    }

    // Verify specific challenge type
    let passed = false;
    let reason = '';

    switch (challenge.type) {
      case 'neutral':
        // Just need a clear face with eyes open
        passed = analysis.attributes?.eyesOpen === true && !analysis.attributes?.smile;
        reason = passed ? '' : 'Please look straight at the camera with a neutral expression';
        break;

      case 'smile':
        passed = analysis.attributes?.smile === true;
        reason = passed ? '' : 'Please smile for the camera';
        break;

      case 'blink':
        // For blink, we need eyes closed in this frame
        // In production, this would analyze video frames
        passed = analysis.attributes?.eyesOpen === false;
        reason = passed ? '' : 'Please blink';
        break;

      case 'turn_left':
        passed = (analysis.attributes?.pose?.yaw || 0) < -15;
        reason = passed ? '' : 'Please turn your head to the left';
        break;

      case 'turn_right':
        passed = (analysis.attributes?.pose?.yaw || 0) > 15;
        reason = passed ? '' : 'Please turn your head to the right';
        break;

      case 'nod':
        passed = Math.abs(analysis.attributes?.pose?.pitch || 0) > 10;
        reason = passed ? '' : 'Please nod your head';
        break;

      default:
        passed = analysis.detected;
    }

    if (passed) {
      challenge.completed = true;
      challenge.confidence = analysis.confidence;
      session.completedChallenges.push(challengeId);
      updateSession(session);
    }

    return { success: passed, confidence: analysis.confidence, reason };
  } catch (error) {
    logger.error('Challenge verification failed:', error);
    return { success: false, confidence: 0, reason: 'Verification service error' };
  }
}

// =============================================================================
// Face Comparison (Selfie vs ID Photo)
// =============================================================================

export async function compareFaces(
  sourceBuffer: Buffer,
  targetBuffer: Buffer,
  similarityThreshold: number = 90
): Promise<{ match: boolean; similarity: number }> {
  try {
    const command = new CompareFacesCommand({
      SourceImage: { Bytes: sourceBuffer },
      TargetImage: { Bytes: targetBuffer },
      SimilarityThreshold: similarityThreshold,
    });

    const response = await rekognition.send(command);

    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      return { match: false, similarity: 0 };
    }

    const bestMatch = response.FaceMatches[0];
    const similarity = bestMatch.Similarity || 0;

    return {
      match: similarity >= similarityThreshold,
      similarity,
    };
  } catch (error) {
    logger.error('Face comparison failed:', error);
    throw new Error('Face comparison failed');
  }
}

// =============================================================================
// Complete Verification
// =============================================================================

export async function completeVerification(
  session: VerificationSession,
  selfieBuffer?: Buffer
): Promise<VerificationResult> {
  // Check all challenges completed
  const allCompleted = session.challenges.every(c => c.completed);
  if (!allCompleted) {
    return {
      success: false,
      confidence: 0,
      reason: 'Not all challenges completed',
    };
  }

  // Calculate average confidence
  const avgConfidence = session.challenges.reduce(
    (sum, c) => sum + (c.confidence || 0), 0
  ) / session.challenges.length;

  // Calculate liveness score based on challenge completion
  const livenessScore = session.challenges.filter(c => c.completed).length / session.challenges.length;

  // If selfie provided, do final verification
  if (selfieBuffer) {
    const analysis = await analyzeFace(selfieBuffer);
    if (!analysis.detected || analysis.confidence < 90) {
      return {
        success: false,
        confidence: analysis.confidence,
        reason: 'Final selfie verification failed',
        livenessScore,
      };
    }
  }

  session.status = 'COMPLETED';
  updateSession(session);

  // Update user verification status
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      verified: true,
      verifiedAt: new Date(),
      verificationStatus: 'VERIFIED',
    },
  });

  return {
    success: true,
    confidence: avgConfidence,
    livenessScore,
  };
}

// =============================================================================
// ID Verification
// =============================================================================

export async function verifyIdDocument(
  userId: string,
  idPhotoBuffer: Buffer,
  selfieBuffer: Buffer
): Promise<VerificationResult> {
  try {
    // 1. Detect face in ID photo
    const idAnalysis = await analyzeFace(idPhotoBuffer);
    if (!idAnalysis.detected) {
      return {
        success: false,
        confidence: 0,
        reason: 'No face detected in ID photo',
      };
    }

    // 2. Detect face in selfie
    const selfieAnalysis = await analyzeFace(selfieBuffer);
    if (!selfieAnalysis.detected) {
      return {
        success: false,
        confidence: 0,
        reason: 'No face detected in selfie',
      };
    }

    // 3. Compare faces
    const comparison = await compareFaces(selfieBuffer, idPhotoBuffer, 85);

    if (!comparison.match) {
      // Queue for manual review instead of auto-reject
      await prisma.user.update({
        where: { id: userId },
        data: {
          verificationStatus: 'PENDING',
          verificationSubmittedAt: new Date(),
        },
      });

      return {
        success: false,
        confidence: comparison.similarity,
        reason: 'Face match inconclusive - queued for manual review',
        faceMatch: false,
      };
    }

    // 4. Mark as verified
    await prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
        verifiedAt: new Date(),
        verificationStatus: 'VERIFIED',
      },
    });

    return {
      success: true,
      confidence: comparison.similarity,
      faceMatch: true,
    };
  } catch (error) {
    logger.error('ID verification failed:', error);

    // Queue for manual review on error
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: 'PENDING',
        verificationSubmittedAt: new Date(),
      },
    });

    return {
      success: false,
      confidence: 0,
      reason: 'Verification service error - queued for manual review',
    };
  }
}

// =============================================================================
// Fallback for Development (when AWS not configured)
// =============================================================================

const USE_MOCK = !process.env.AWS_ACCESS_KEY_ID || process.env.NODE_ENV === 'development';

export async function analyzeFaceMock(imageBuffer: Buffer): Promise<FaceAnalysis> {
  // Basic validation - check if it's actually an image
  if (imageBuffer.length < 1000) {
    return { detected: false, confidence: 0 };
  }

  // Check for JPEG/PNG magic bytes
  const isJpeg = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;
  const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;

  if (!isJpeg && !isPng) {
    return { detected: false, confidence: 0 };
  }

  // In dev mode, return mock success with warning
  logger.warn('Using MOCK face analysis - NOT FOR PRODUCTION');

  return {
    detected: true,
    confidence: 95,
    attributes: {
      eyesOpen: true,
      mouthOpen: false,
      smile: false,
      pose: { pitch: 0, roll: 0, yaw: 0 },
    },
  };
}

// Export the appropriate function based on environment
export const detectFace = USE_MOCK ? analyzeFaceMock : analyzeFace;

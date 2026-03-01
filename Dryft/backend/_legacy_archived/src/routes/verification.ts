import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { verificationRateLimit } from '../middleware/rateLimit.js';
import * as verificationService from '../services/verification.js';
import * as s3Service from '../services/s3.js';
import { logger } from '../utils/logger.js';

const router = Router();

// =============================================================================
// Start Verification Session
// =============================================================================

router.post('/start', verificationRateLimit, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // Check if already verified
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { verified: true, verificationStatus: true },
    });

    if (user?.verified) {
      return res.status(400).json({
        error: 'Already verified',
        status: 'verified',
      });
    }

    // Create new session
    const session = verificationService.createSession(userId);

    res.json({
      session_id: session.id,
      challenges: session.challenges.map(c => ({
        id: c.id,
        type: c.type,
        order: c.order,
        instructions: getChallengeInstructions(c.type),
      })),
      expires_at: session.expiresAt.toISOString(),
      max_attempts: session.maxAttempts,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Complete Challenge
// =============================================================================

router.post('/challenge/complete', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { session_id, challenge_id, image_data } = req.body;

    if (!session_id || !challenge_id) {
      throw new AppError(400, 'session_id and challenge_id required');
    }

    // Get session
    const session = verificationService.getSession(session_id);
    if (!session) {
      throw new AppError(404, 'Session not found or expired');
    }

    if (session.userId !== userId) {
      throw new AppError(403, 'Session does not belong to this user');
    }

    if (session.status === 'EXPIRED') {
      throw new AppError(410, 'Session expired');
    }

    if (session.status === 'FAILED') {
      throw new AppError(400, 'Session failed - please start a new session');
    }

    // Decode base64 image
    let imageBuffer: Buffer;
    try {
      const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch {
      throw new AppError(400, 'Invalid image data');
    }

    if (imageBuffer.length < 1000) {
      throw new AppError(400, 'Image too small');
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw new AppError(400, 'Image too large (max 10MB)');
    }

    // Verify challenge
    const result = await verificationService.verifyChallenge(
      session,
      challenge_id,
      imageBuffer
    );

    // Get updated session
    const updatedSession = verificationService.getSession(session_id);
    const completedCount = updatedSession?.completedChallenges.length || 0;
    const totalCount = updatedSession?.challenges.length || 0;

    res.json({
      success: result.success,
      confidence: result.confidence,
      message: result.reason || (result.success ? 'Challenge passed' : 'Challenge failed'),
      progress: {
        completed: completedCount,
        total: totalCount,
        remaining_attempts: (updatedSession?.maxAttempts || 0) - (updatedSession?.attempts || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Submit Verification (after all challenges)
// =============================================================================

router.post('/submit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { session_id, final_selfie } = req.body;

    if (!session_id) {
      throw new AppError(400, 'session_id required');
    }

    const session = verificationService.getSession(session_id);
    if (!session) {
      throw new AppError(404, 'Session not found or expired');
    }

    if (session.userId !== userId) {
      throw new AppError(403, 'Session does not belong to this user');
    }

    // Decode final selfie if provided
    let selfieBuffer: Buffer | undefined;
    if (final_selfie) {
      try {
        const base64Data = final_selfie.replace(/^data:image\/\w+;base64,/, '');
        selfieBuffer = Buffer.from(base64Data, 'base64');
      } catch {
        throw new AppError(400, 'Invalid selfie data');
      }
    }

    // Complete verification
    const result = await verificationService.completeVerification(session, selfieBuffer);

    if (result.success) {
      // Clean up session
      verificationService.deleteSession(session_id);

      res.json({
        success: true,
        status: 'verified',
        verified_at: new Date().toISOString(),
        confidence: result.confidence,
        liveness_score: result.livenessScore,
        badge: {
          type: 'verified',
          awarded_at: new Date().toISOString(),
        },
      });
    } else {
      res.status(400).json({
        success: false,
        status: 'failed',
        message: result.reason,
        confidence: result.confidence,
      });
    }
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Photo Verification (Manual Review Queue)
// =============================================================================

router.post('/photo', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { photo_data } = req.body;

    if (!photo_data) {
      throw new AppError(400, 'photo_data required');
    }

    // Decode and validate image
    let imageBuffer: Buffer;
    try {
      const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch {
      throw new AppError(400, 'Invalid photo data');
    }

    // Basic face detection
    const analysis = await verificationService.detectFace(imageBuffer);
    if (!analysis.detected) {
      return res.status(400).json({
        success: false,
        message: 'No face detected in photo. Please upload a clear photo of your face.',
      });
    }

    // Upload to S3
    const uploadResult = await s3Service.uploadFile({
      userId,
      category: 'verification',
      buffer: imageBuffer,
      contentType: 'image/jpeg',
    });

    // Queue for manual review
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: 'PENDING',
        verificationPhotoUrl: uploadResult.publicUrl,
        verificationSubmittedAt: new Date(),
      },
    });

    logger.info(`Verification photo submitted for user ${userId}`);

    res.json({
      success: true,
      status: 'pending',
      message: 'Your photo has been submitted for review. This usually takes 24-48 hours.',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// ID Verification
// =============================================================================

router.post('/id', verificationRateLimit, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id_photo, selfie_photo } = req.body;

    if (!id_photo || !selfie_photo) {
      throw new AppError(400, 'Both id_photo and selfie_photo required');
    }

    // Decode images
    let idBuffer: Buffer;
    let selfieBuffer: Buffer;

    try {
      const idBase64 = id_photo.replace(/^data:image\/\w+;base64,/, '');
      idBuffer = Buffer.from(idBase64, 'base64');

      const selfieBase64 = selfie_photo.replace(/^data:image\/\w+;base64,/, '');
      selfieBuffer = Buffer.from(selfieBase64, 'base64');
    } catch {
      throw new AppError(400, 'Invalid image data');
    }

    // Perform ID verification
    const result = await verificationService.verifyIdDocument(
      userId,
      idBuffer,
      selfieBuffer
    );

    if (result.success) {
      res.json({
        success: true,
        status: 'verified',
        verified_at: new Date().toISOString(),
        confidence: result.confidence,
        face_match: result.faceMatch,
        badge: {
          type: 'id_verified',
          awarded_at: new Date().toISOString(),
        },
      });
    } else {
      // If queued for manual review
      const isPending = result.reason?.includes('manual review');

      res.status(isPending ? 202 : 400).json({
        success: false,
        status: isPending ? 'pending' : 'failed',
        message: result.reason,
        confidence: result.confidence,
      });
    }
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get Verification Status
// =============================================================================

router.get('/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        verified: true,
        verifiedAt: true,
        verificationStatus: true,
        verificationSubmittedAt: true,
      },
    });

    const status = user?.verificationStatus?.toLowerCase() || 'unverified';

    res.json({
      status,
      verified: user?.verified || false,
      verified_at: user?.verifiedAt,
      submitted_at: user?.verificationSubmittedAt,
      badge: user?.verified ? {
        type: 'verified',
        awarded_at: user.verifiedAt?.toISOString(),
      } : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Cancel Session
// =============================================================================

router.post('/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { session_id } = req.body;

    if (session_id) {
      const session = verificationService.getSession(session_id);
      if (session && session.userId === req.user!.id) {
        verificationService.deleteSession(session_id);
      }
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Helpers
// =============================================================================

function getChallengeInstructions(type: verificationService.ChallengeType): string {
  const instructions: Record<string, string> = {
    neutral: 'Look straight at the camera with a neutral expression',
    smile: 'Smile naturally for the camera',
    blink: 'Blink your eyes',
    turn_left: 'Slowly turn your head to the left',
    turn_right: 'Slowly turn your head to the right',
    nod: 'Nod your head up and down',
  };
  return instructions[type] || 'Complete the challenge';
}

export default router;

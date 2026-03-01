import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import * as s3Service from '../services/s3.js';
import type { UploadCategory } from '../services/s3.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const router = Router();

// =============================================================================
// Constants
// =============================================================================

const VALID_CATEGORIES: UploadCategory[] = [
  'avatars',
  'photos',
  'stories',
  'chat',
  'gifts',
  'verification',
  'memories',
];

// SEC-004: Server-side validation limits for presigned URLs
const CATEGORY_SIZE_LIMITS: Record<UploadCategory, number> = {
  avatars: 5 * 1024 * 1024,      // 5MB
  photos: 10 * 1024 * 1024,      // 10MB
  stories: 50 * 1024 * 1024,     // 50MB
  chat: 25 * 1024 * 1024,        // 25MB
  gifts: 10 * 1024 * 1024,       // 10MB
  verification: 10 * 1024 * 1024, // 10MB
  memories: 50 * 1024 * 1024,    // 50MB
};

const CATEGORY_CONTENT_TYPES: Record<UploadCategory, string[]> = {
  avatars: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  photos: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  stories: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'],
  chat: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg'],
  gifts: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  verification: ['image/jpeg', 'image/png', 'image/webp'],
  memories: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'],
};

// Multer configuration for direct uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (will be validated per category)
  },
});

// =============================================================================
// Get Presigned Upload URL
// =============================================================================
// POST /uploads/presigned
// Body: { category, contentType, fileSize }
// Returns presigned URL for direct client-to-S3 upload
router.post('/presigned', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { category, contentType, fileSize } = req.body;

    if (!category || !contentType || !fileSize) {
      res.status(400).json({
        error: 'Missing required fields: category, contentType, fileSize',
      });
      return;
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({
        error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
      return;
    }

    // SEC-004: Server-side file size validation
    const parsedFileSize = parseInt(fileSize, 10);
    if (isNaN(parsedFileSize) || parsedFileSize <= 0) {
      res.status(400).json({ error: 'Invalid file size' });
      return;
    }

    const maxSize = CATEGORY_SIZE_LIMITS[category as UploadCategory];
    if (parsedFileSize > maxSize) {
      res.status(400).json({
        error: `File too large for ${category}. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`,
        maxSize,
      });
      return;
    }

    // SEC-004: Server-side content type validation per category
    const allowedTypes = CATEGORY_CONTENT_TYPES[category as UploadCategory];
    if (!allowedTypes.includes(contentType)) {
      res.status(400).json({
        error: `Content type ${contentType} not allowed for ${category}`,
        allowedTypes,
      });
      return;
    }

    // Validate content type against global supported types
    if (!s3Service.isValidContentType(contentType)) {
      res.status(400).json({
        error: 'Unsupported content type',
        supportedTypes: s3Service.SUPPORTED_TYPES,
      });
      return;
    }

    const result = await s3Service.generatePresignedUploadUrl({
      userId,
      category,
      contentType,
      fileSize: parsedFileSize,
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Presigned URL error:', error);
    res.status(400).json({ error: error.message });
  }
});

// =============================================================================
// Get Multiple Presigned URLs (batch)
// =============================================================================
// POST /uploads/presigned/batch
// Body: { uploads: [{ category, contentType, fileSize }] }
router.post('/presigned/batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { uploads } = req.body;

    if (!uploads || !Array.isArray(uploads)) {
      res.status(400).json({ error: 'uploads array is required' });
      return;
    }

    if (uploads.length > 10) {
      res.status(400).json({ error: 'Maximum 10 uploads per batch' });
      return;
    }

    const requests = uploads.map((u: any) => ({
      userId,
      category: u.category,
      contentType: u.contentType,
      fileSize: u.fileSize,
    }));

    const results = await s3Service.generateMultiplePresignedUrls(requests);

    res.json({ uploads: results });
  } catch (error: any) {
    logger.error('Batch presigned URL error:', error);
    res.status(400).json({ error: error.message });
  }
});

// =============================================================================
// Direct Upload (server-side)
// =============================================================================
// POST /uploads/direct/:category
// Body: multipart form with 'file' field
router.post(
  '/direct/:category',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { category } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      if (!VALID_CATEGORIES.includes(category as UploadCategory)) {
        res.status(400).json({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
        return;
      }

      const result = await s3Service.uploadFile({
        userId,
        category: category as UploadCategory,
        buffer: file.buffer,
        contentType: file.mimetype,
        originalFilename: file.originalname,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Direct upload error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// =============================================================================
// Upload Avatar (convenience endpoint)
// =============================================================================
// POST /uploads/avatar
// Body: multipart form with 'avatar' field
router.post(
  '/avatar',
  authenticate,
  upload.single('avatar'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      if (!s3Service.isValidImageType(file.mimetype)) {
        res.status(400).json({
          error: 'Avatar must be an image (JPEG, PNG, WebP, or GIF)',
        });
        return;
      }

      // Upload new avatar
      const result = await s3Service.uploadFile({
        userId,
        category: 'avatars',
        buffer: file.buffer,
        contentType: file.mimetype,
      });

      // Get current user to find old avatar
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      // Delete old avatar if it's on S3
      if (user?.avatarUrl) {
        const oldKey = s3Service.extractKeyFromUrl(user.avatarUrl);
        if (oldKey) {
          await s3Service.deleteFile(oldKey).catch((err) => {
            // ERR-007: Log with enough detail for manual cleanup if needed
            logger.warn('Failed to delete old avatar from S3', {
              key: oldKey,
              userId,
              error: err.message,
              action: 'MANUAL_CLEANUP_MAY_BE_NEEDED',
            });
          });
        }
      }

      // Update user's avatar URL
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: result.publicUrl },
      });

      res.json({
        avatarUrl: result.publicUrl,
        key: result.key,
      });
    } catch (error: any) {
      logger.error('Avatar upload error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// =============================================================================
// Upload Photos (for profile gallery)
// =============================================================================
// POST /uploads/photos
// Body: multipart form with 'photos' field (multiple)
router.post(
  '/photos',
  authenticate,
  upload.array('photos', 6),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const results = await Promise.all(
        files.map(async (file) => {
          if (!s3Service.isValidImageType(file.mimetype)) {
            throw new Error(`Invalid image type: ${file.originalname}`);
          }

          return s3Service.uploadFile({
            userId,
            category: 'photos',
            buffer: file.buffer,
            contentType: file.mimetype,
            originalFilename: file.originalname,
          });
        })
      );

      // Add photos to user's profile
      await prisma.userPhoto.createMany({
        data: results.map((r, index) => ({
          userId,
          photoUrl: r.publicUrl,
          orderIndex: index,
        })),
      });

      res.json({
        photos: results.map((r) => ({
          url: r.publicUrl,
          key: r.key,
        })),
      });
    } catch (error: any) {
      logger.error('Photos upload error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// =============================================================================
// Delete Photo
// =============================================================================
// DELETE /uploads/photos/:photoId
router.delete('/photos/:photoId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { photoId } = req.params;

    const photo = await prisma.userPhoto.findFirst({
      where: {
        id: photoId,
        userId,
      },
    });

    if (!photo) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    // Delete from S3
    const key = s3Service.extractKeyFromUrl(photo.photoUrl);
    if (key) {
      await s3Service.deleteFile(key).catch((err) => {
        // ERR-007: Log with enough detail for manual cleanup if needed
        logger.warn('Failed to delete photo from S3', {
          key,
          userId,
          photoId,
          error: err.message,
          action: 'MANUAL_CLEANUP_MAY_BE_NEEDED',
        });
      });
    }

    // Delete from database
    await prisma.userPhoto.delete({
      where: { id: photoId },
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete photo error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Confirm Upload (after presigned upload completes)
// =============================================================================
// POST /uploads/confirm
// Body: { key, category, metadata? }
router.post('/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { key, category, metadata } = req.body;

    if (!key || !category) {
      res.status(400).json({ error: 'key and category are required' });
      return;
    }

    // Verify the key belongs to this user with proper path validation
    // Expected format: {category}/{userId}/{filename}
    const keyParts = key.split('/');
    if (keyParts.length < 3) {
      res.status(403).json({ error: 'Invalid key format' });
      return;
    }

    const keyCategory = keyParts[0];
    const keyUserId = keyParts[1];

    // Strict validation: category must match and userId must be exact match
    if (keyUserId !== userId || keyCategory !== category) {
      logger.warn(`Upload confirm authorization failed: userId=${userId}, keyUserId=${keyUserId}, category=${category}, keyCategory=${keyCategory}`);
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const publicUrl = s3Service.getPublicUrl(key);

    // Handle different categories
    switch (category) {
      case 'avatars': {
        // Get current avatar to delete old one
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { avatarUrl: true },
        });

        if (user?.avatarUrl) {
          const oldKey = s3Service.extractKeyFromUrl(user.avatarUrl);
          if (oldKey && oldKey !== key) {
            await s3Service.deleteFile(oldKey).catch((err) => {
              // ERR-007: Log with enough detail for manual cleanup if needed
              logger.warn('Failed to delete old avatar from S3 (confirm)', {
                key: oldKey,
                userId,
                newKey: key,
                error: err.message,
                action: 'MANUAL_CLEANUP_MAY_BE_NEEDED',
              });
            });
          }
        }

        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: publicUrl },
        });
        break;
      }

      case 'photos':
        await prisma.userPhoto.create({
          data: {
            userId,
            photoUrl: publicUrl,
            orderIndex: metadata?.orderIndex || 0,
          },
        });
        break;

      case 'verification':
        // Store verification image reference
        await prisma.user.update({
          where: { id: userId },
          data: {
            verificationPhotoUrl: publicUrl,
            verificationStatus: 'PENDING',
          },
        });
        break;

      // Other categories don't need database updates here
      // They're handled by their respective features (stories, chat, etc.)
    }

    res.json({
      success: true,
      publicUrl,
      key,
    });
  } catch (error: any) {
    logger.error('Confirm upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// Get Upload Limits
// =============================================================================
// GET /uploads/limits
router.get('/limits', authenticate, (req: AuthRequest, res: Response) => {
  res.json({
    limits: {
      avatars: { maxSize: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      photos: { maxSize: 10 * 1024 * 1024, maxCount: 6, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      stories: { maxSize: 50 * 1024 * 1024, types: [...s3Service.SUPPORTED_TYPES.image, ...s3Service.SUPPORTED_TYPES.video] },
      chat: { maxSize: 25 * 1024 * 1024, types: [...s3Service.SUPPORTED_TYPES.image, ...s3Service.SUPPORTED_TYPES.video, ...s3Service.SUPPORTED_TYPES.audio] },
      memories: { maxSize: 50 * 1024 * 1024, types: [...s3Service.SUPPORTED_TYPES.image, ...s3Service.SUPPORTED_TYPES.video] },
    },
    supportedTypes: s3Service.SUPPORTED_TYPES,
  });
});

export default router;

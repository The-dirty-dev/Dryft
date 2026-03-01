import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import path from 'path';

// =============================================================================
// S3 Client Configuration
// =============================================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'drift-uploads';
const CDN_URL = process.env.CDN_URL || `https://${BUCKET_NAME}.s3.amazonaws.com`;

// =============================================================================
// File Type Configuration
// =============================================================================

export type UploadCategory =
  | 'avatars'
  | 'photos'
  | 'stories'
  | 'chat'
  | 'gifts'
  | 'verification'
  | 'memories';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];

const MAX_FILE_SIZES: Record<UploadCategory, number> = {
  avatars: 5 * 1024 * 1024,       // 5MB
  photos: 10 * 1024 * 1024,       // 10MB
  stories: 50 * 1024 * 1024,      // 50MB (can be video)
  chat: 25 * 1024 * 1024,         // 25MB
  gifts: 5 * 1024 * 1024,         // 5MB
  verification: 10 * 1024 * 1024, // 10MB
  memories: 50 * 1024 * 1024,     // 50MB
};

// =============================================================================
// Helper Functions
// =============================================================================

function getContentTypeCategory(contentType: string): 'image' | 'video' | 'audio' | null {
  if (ALLOWED_IMAGE_TYPES.includes(contentType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(contentType)) return 'video';
  if (ALLOWED_AUDIO_TYPES.includes(contentType)) return 'audio';
  return null;
}

function getFileExtension(contentType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/m4a': '.m4a',
  };
  return extensions[contentType] || '';
}

function generateKey(
  userId: string,
  category: UploadCategory,
  contentType: string
): string {
  const ext = getFileExtension(contentType);
  const timestamp = Date.now();
  const uniqueId = uuid().slice(0, 8);
  return `${category}/${userId}/${timestamp}-${uniqueId}${ext}`;
}

// =============================================================================
// Presigned URL Generation
// =============================================================================

export interface PresignedUrlRequest {
  userId: string;
  category: UploadCategory;
  contentType: string;
  fileSize: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

export async function generatePresignedUploadUrl(
  request: PresignedUrlRequest
): Promise<PresignedUrlResponse> {
  const { userId, category, contentType, fileSize } = request;

  // Validate content type
  const mediaType = getContentTypeCategory(contentType);
  if (!mediaType) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  // Validate file size
  const maxSize = MAX_FILE_SIZES[category];
  if (fileSize > maxSize) {
    throw new Error(
      `File size ${fileSize} exceeds maximum ${maxSize} bytes for ${category}`
    );
  }

  // Category-specific validations
  if (category === 'avatars' && mediaType !== 'image') {
    throw new Error('Avatars must be images');
  }

  const key = generateKey(userId, category, contentType);
  const expiresIn = 3600; // 1 hour

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSize,
    Metadata: {
      'user-id': userId,
      'upload-category': category,
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return {
    uploadUrl,
    key,
    publicUrl: `${CDN_URL}/${key}`,
    expiresIn,
  };
}

// =============================================================================
// Direct Upload (for server-side uploads)
// =============================================================================

export interface DirectUploadRequest {
  userId: string;
  category: UploadCategory;
  buffer: Buffer;
  contentType: string;
  originalFilename?: string;
}

export async function uploadFile(
  request: DirectUploadRequest
): Promise<{ key: string; publicUrl: string }> {
  const { userId, category, buffer, contentType } = request;

  // Validate content type
  const mediaType = getContentTypeCategory(contentType);
  if (!mediaType) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  // Validate file size
  const maxSize = MAX_FILE_SIZES[category];
  if (buffer.length > maxSize) {
    throw new Error(
      `File size ${buffer.length} exceeds maximum ${maxSize} bytes for ${category}`
    );
  }

  const key = generateKey(userId, category, contentType);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: {
      'user-id': userId,
      'upload-category': category,
    },
  });

  await s3Client.send(command);

  return {
    key,
    publicUrl: `${CDN_URL}/${key}`,
  };
}

// =============================================================================
// File Deletion
// =============================================================================

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export async function deleteMultipleFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => deleteFile(key)));
}

// =============================================================================
// Presigned Download URL (for private files)
// =============================================================================

export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// =============================================================================
// URL Helpers
// =============================================================================

export function getPublicUrl(key: string): string {
  return `${CDN_URL}/${key}`;
}

export function extractKeyFromUrl(url: string): string | null {
  if (url.startsWith(CDN_URL)) {
    return url.slice(CDN_URL.length + 1);
  }

  // Handle S3 URL format
  const s3Pattern = new RegExp(`https://${BUCKET_NAME}\\.s3\\.[^/]+\\.amazonaws\\.com/(.+)`);
  const match = url.match(s3Pattern);
  if (match) {
    return match[1];
  }

  return null;
}

// =============================================================================
// Batch Operations
// =============================================================================

export async function generateMultiplePresignedUrls(
  requests: PresignedUrlRequest[]
): Promise<PresignedUrlResponse[]> {
  return Promise.all(requests.map(generatePresignedUploadUrl));
}

// =============================================================================
// Validation Utilities
// =============================================================================

export function isValidContentType(contentType: string): boolean {
  return getContentTypeCategory(contentType) !== null;
}

export function isValidImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType);
}

export function isValidVideoType(contentType: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(contentType);
}

export function getMaxFileSize(category: UploadCategory): number {
  return MAX_FILE_SIZES[category];
}

export const SUPPORTED_TYPES = {
  image: ALLOWED_IMAGE_TYPES,
  video: ALLOWED_VIDEO_TYPES,
  audio: ALLOWED_AUDIO_TYPES,
};

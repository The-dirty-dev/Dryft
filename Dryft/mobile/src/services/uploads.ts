import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import api from './api';

/**
 * Media upload helpers for profile photos, stories, and avatars.
 * Handles local file prep and backend upload endpoints.
 * @example
 * await uploadPhoto(asset);
 */
// =============================================================================
// Types
// =============================================================================

export type UploadCategory =
  | 'avatars'
  | 'photos'
  | 'stories'
  | 'chat'
  | 'gifts'
  | 'verification'
  | 'memories';

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

export interface UploadResult {
  publicUrl: string;
  key: string;
}

export interface ImagePickerResult {
  uri: string;
  type: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

// =============================================================================
// Image Picker Helpers
// =============================================================================

export async function pickImage(
  options: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
    allowsMultipleSelection?: boolean;
    mediaTypes?: 'Images' | 'Videos' | 'All';
  } = {}
): Promise<ImagePickerResult[]> {
  const {
    allowsEditing = false,
    aspect,
    quality = 0.8,
    allowsMultipleSelection = false,
    mediaTypes = 'Images',
  } = options;

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission to access media library was denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes:
      mediaTypes === 'All'
        ? ImagePicker.MediaTypeOptions.All
        : mediaTypes === 'Videos'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images,
    allowsEditing,
    aspect,
    quality,
    allowsMultipleSelection,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.map((asset) => ({
    uri: asset.uri,
    type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
  }));
}

export async function takePhoto(
  options: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  } = {}
): Promise<ImagePickerResult | null> {
  const { allowsEditing = false, aspect, quality = 0.8 } = options;

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permission to access camera was denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing,
    aspect,
    quality,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    type: 'image/jpeg',
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
  };
}

// =============================================================================
// File Info Helpers
// =============================================================================

async function getFileInfo(uri: string): Promise<{ size: number; exists: boolean }> {
  const info = await FileSystem.getInfoAsync(uri);
  return {
    size: (info as any).size || 0,
    exists: info.exists,
  };
}

function getContentType(uri: string, providedType?: string): string {
  if (providedType && providedType !== 'image' && providedType !== 'video') {
    return providedType;
  }

  const extension = uri.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/m4a',
  };

  return types[extension || ''] || 'application/octet-stream';
}

// =============================================================================
// Upload Functions
// =============================================================================

export async function getPresignedUrl(
  category: UploadCategory,
  contentType: string,
  fileSize: number
): Promise<PresignedUrlResponse> {
  const response = await api.post('/uploads/presigned', {
    category,
    contentType,
    fileSize,
  });
  return response.data;
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  uri: string,
  contentType: string
): Promise<void> {
  const response = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

export async function confirmUpload(
  key: string,
  category: UploadCategory,
  metadata?: Record<string, any>
): Promise<{ success: boolean; publicUrl: string }> {
  const response = await api.post('/uploads/confirm', {
    key,
    category,
    metadata,
  });
  return response.data;
}

// =============================================================================
// High-Level Upload Functions
// =============================================================================

export async function uploadFile(
  uri: string,
  category: UploadCategory,
  options: {
    contentType?: string;
    onProgress?: (progress: number) => void;
  } = {}
): Promise<UploadResult> {
  const { contentType: providedType, onProgress } = options;

  // Get file info
  const fileInfo = await getFileInfo(uri);
  if (!fileInfo.exists) {
    throw new Error('File does not exist');
  }

  const contentType = getContentType(uri, providedType);

  // Get presigned URL
  onProgress?.(0.1);
  const presigned = await getPresignedUrl(category, contentType, fileInfo.size);

  // Upload to S3
  onProgress?.(0.3);
  await uploadToPresignedUrl(presigned.uploadUrl, uri, contentType);

  // Confirm upload
  onProgress?.(0.9);
  await confirmUpload(presigned.key, category);

  onProgress?.(1);
  return {
    publicUrl: presigned.publicUrl,
    key: presigned.key,
  };
}

export async function uploadAvatar(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'avatars', { onProgress });
}

export async function uploadPhoto(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'photos', { onProgress });
}

export async function uploadStoryMedia(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'stories', { onProgress });
}

export async function uploadChatMedia(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'chat', { onProgress });
}

export async function uploadMemoryMedia(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'memories', { onProgress });
}

export async function uploadVerificationPhoto(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'verification', { onProgress });
}

// =============================================================================
// Batch Upload
// =============================================================================

export async function uploadMultipleFiles(
  files: { uri: string; category: UploadCategory }[],
  onProgress?: (completed: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadFile(file.uri, file.category);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }

  return results;
}

// =============================================================================
// Pick and Upload Helpers
// =============================================================================

export async function pickAndUploadAvatar(
  onProgress?: (progress: number) => void
): Promise<UploadResult | null> {
  const images = await pickImage({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (images.length === 0) {
    return null;
  }

  return uploadAvatar(images[0].uri, onProgress);
}

export async function pickAndUploadPhotos(
  maxCount: number = 6,
  onProgress?: (completed: number, total: number) => void
): Promise<UploadResult[]> {
  const images = await pickImage({
    allowsMultipleSelection: true,
    quality: 0.8,
  });

  if (images.length === 0) {
    return [];
  }

  const toUpload = images.slice(0, maxCount);
  return uploadMultipleFiles(
    toUpload.map((img) => ({ uri: img.uri, category: 'photos' })),
    onProgress
  );
}

export async function pickAndUploadStory(
  onProgress?: (progress: number) => void
): Promise<UploadResult | null> {
  const media = await pickImage({
    mediaTypes: 'All',
    quality: 0.8,
  });

  if (media.length === 0) {
    return null;
  }

  return uploadStoryMedia(media[0].uri, onProgress);
}

export async function takeAndUploadPhoto(
  category: UploadCategory = 'photos',
  onProgress?: (progress: number) => void
): Promise<UploadResult | null> {
  const photo = await takePhoto({
    quality: 0.8,
  });

  if (!photo) {
    return null;
  }

  return uploadFile(photo.uri, category, { onProgress });
}

// =============================================================================
// Delete
// =============================================================================

export async function deletePhoto(photoId: string): Promise<void> {
  await api.delete(`/uploads/photos/${photoId}`);
}

// =============================================================================
// Get Upload Limits
// =============================================================================

export async function getUploadLimits(): Promise<{
  limits: Record<string, { maxSize: number; types: string[]; maxCount?: number }>;
  supportedTypes: { image: string[]; video: string[]; audio: string[] };
}> {
  const response = await api.get('/uploads/limits');
  return response.data;
}

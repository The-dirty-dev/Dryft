import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gif';
  uri: string;
  remoteUrl?: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  duration?: number;
  size: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadProgress?: number;
}

export interface ImagePickerConfig {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  thumbnailUrl?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MEDIA_DIR = `${FileSystem.documentDirectory}chat_media/`;
const THUMBNAIL_DIR = `${FileSystem.documentDirectory}chat_thumbnails/`;

const DEFAULT_CONFIG: ImagePickerConfig = {
  allowsEditing: false,
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1920,
  allowsMultipleSelection: false,
  selectionLimit: 10,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const THUMBNAIL_SIZE = 300;

// ============================================================================
// Chat Media Service
// ============================================================================

class ChatMediaService {
  private static instance: ChatMediaService;

  private constructor() {
    this.ensureDirectories();
  }

  static getInstance(): ChatMediaService {
    if (!ChatMediaService.instance) {
      ChatMediaService.instance = new ChatMediaService();
    }
    return ChatMediaService.instance;
  }

  // ==========================================================================
  // Directory Management
  // ==========================================================================

  private async ensureDirectories(): Promise<void> {
    const dirs = [MEDIA_DIR, THUMBNAIL_DIR];
    for (const dir of dirs) {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    }
  }

  // ==========================================================================
  // Permissions
  // ==========================================================================

  async requestCameraPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }

  async requestMediaLibraryPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  // ==========================================================================
  // Image Picking
  // ==========================================================================

  async pickImage(config: ImagePickerConfig = {}): Promise<MediaAttachment[] | null> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    const hasPermission = await this.requestMediaLibraryPermission();
    if (!hasPermission) {
      console.warn('[ChatMedia] No media library permission');
      return null;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: mergedConfig.allowsEditing,
        aspect: mergedConfig.aspect,
        quality: mergedConfig.quality,
        allowsMultipleSelection: mergedConfig.allowsMultipleSelection,
        selectionLimit: mergedConfig.selectionLimit,
      });

      if (result.canceled) {
        return null;
      }

      const attachments: MediaAttachment[] = [];

      for (const asset of result.assets) {
        const processed = await this.processImage(asset, mergedConfig);
        if (processed) {
          attachments.push(processed);
        }
      }

      trackEvent('chat_image_picked', {
        count: attachments.length,
        source: 'library',
      });

      return attachments.length > 0 ? attachments : null;
    } catch (error) {
      console.error('[ChatMedia] Failed to pick image:', error);
      return null;
    }
  }

  async takePhoto(config: ImagePickerConfig = {}): Promise<MediaAttachment | null> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config, allowsMultipleSelection: false };

    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      console.warn('[ChatMedia] No camera permission');
      return null;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: mergedConfig.allowsEditing,
        aspect: mergedConfig.aspect,
        quality: mergedConfig.quality,
      });

      if (result.canceled || result.assets.length === 0) {
        return null;
      }

      const processed = await this.processImage(result.assets[0], mergedConfig);

      if (processed) {
        trackEvent('chat_image_taken', { source: 'camera' });
      }

      return processed;
    } catch (error) {
      console.error('[ChatMedia] Failed to take photo:', error);
      return null;
    }
  }

  // ==========================================================================
  // Image Processing
  // ==========================================================================

  private async processImage(
    asset: ImagePicker.ImagePickerAsset,
    config: ImagePickerConfig
  ): Promise<MediaAttachment | null> {
    try {
      let uri = asset.uri;
      let width = asset.width;
      let height = asset.height;

      // Resize if needed
      const maxDimension = Math.max(config.maxWidth || 1920, config.maxHeight || 1920);
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }],
          { compress: config.quality, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = result.uri;
        width = result.width;
        height = result.height;
      }

      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const size = (fileInfo as any).size || 0;

      // Check file size limit
      if (size > MAX_FILE_SIZE) {
        console.warn('[ChatMedia] File too large:', size);
        // Try to compress more
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = result.uri;
        const newInfo = await FileSystem.getInfoAsync(uri);
        if ((newInfo as any).size > MAX_FILE_SIZE) {
          console.error('[ChatMedia] Cannot compress enough');
          return null;
        }
      }

      // Save to media directory
      const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const localUri = `${MEDIA_DIR}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: localUri });

      // Generate thumbnail
      const thumbnail = await this.generateThumbnail(localUri);

      return {
        id: `attachment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        uri: localUri,
        thumbnailUrl: thumbnail,
        width,
        height,
        size,
        status: 'pending',
      };
    } catch (error) {
      console.error('[ChatMedia] Failed to process image:', error);
      return null;
    }
  }

  private async generateThumbnail(uri: string): Promise<string | undefined> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const filename = `thumb_${Date.now()}.jpg`;
      const thumbnailUri = `${THUMBNAIL_DIR}${filename}`;
      await FileSystem.moveAsync({ from: result.uri, to: thumbnailUri });

      return thumbnailUri;
    } catch (error) {
      console.error('[ChatMedia] Failed to generate thumbnail:', error);
      return undefined;
    }
  }

  // ==========================================================================
  // Upload
  // ==========================================================================

  async uploadMedia(
    attachment: MediaAttachment,
    matchId: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Simulate upload progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress = Math.min(progress + 10, 90);
        onProgress?.(progress);
      }, 200);

      // Upload to server
      const response = await api.post<{
        url: string;
        thumbnail_url: string;
      }>('/v1/messages/media', {
        match_id: matchId,
        media_type: attachment.type,
        media_data: base64,
        width: attachment.width,
        height: attachment.height,
      });

      clearInterval(progressInterval);
      onProgress?.(100);

      trackEvent('chat_media_uploaded', {
        type: attachment.type,
        size: attachment.size,
      });

      return {
        success: true,
        url: response.data!.url,
        thumbnailUrl: response.data!.thumbnail_url,
      };
    } catch (error: any) {
      console.error('[ChatMedia] Upload failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==========================================================================
  // Download
  // ==========================================================================

  async downloadMedia(remoteUrl: string): Promise<string | null> {
    try {
      const filename = `dl_${Date.now()}.jpg`;
      const localUri = `${MEDIA_DIR}${filename}`;

      const result = await FileSystem.downloadAsync(remoteUrl, localUri);

      if (result.status === 200) {
        return result.uri;
      }

      return null;
    } catch (error) {
      console.error('[ChatMedia] Download failed:', error);
      return null;
    }
  }

  // ==========================================================================
  // GIF Support
  // ==========================================================================

  async searchGifs(query: string, limit: number = 20): Promise<GifResult[]> {
    try {
      // In a real app, this would call a GIF API like Giphy or Tenor
      const response = await api.get<{ gifs: GifResult[] }>('/v1/gifs/search', {
        params: { q: query, limit },
      });

      return response.data!.gifs;
    } catch (error) {
      console.error('[ChatMedia] GIF search failed:', error);
      return [];
    }
  }

  async getTrendingGifs(limit: number = 20): Promise<GifResult[]> {
    try {
      const response = await api.get<{ gifs: GifResult[] }>('/v1/gifs/trending', {
        params: { limit },
      });

      return response.data!.gifs;
    } catch (error) {
      console.error('[ChatMedia] Trending GIFs failed:', error);
      return [];
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  async deleteLocalMedia(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      console.error('[ChatMedia] Delete failed:', error);
    }
  }

  async clearCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const dirs = [MEDIA_DIR, THUMBNAIL_DIR];

    for (const dir of dirs) {
      try {
        const files = await FileSystem.readDirectoryAsync(dir);
        for (const file of files) {
          const filePath = `${dir}${file}`;
          const info = await FileSystem.getInfoAsync(filePath);
          if (info.exists && info.modificationTime) {
            const age = now - info.modificationTime * 1000;
            if (age > maxAge) {
              await FileSystem.deleteAsync(filePath, { idempotent: true });
            }
          }
        }
      } catch (error) {
        console.error('[ChatMedia] Cache clear failed for dir:', dir, error);
      }
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getMaxFileSize(): number {
    return MAX_FILE_SIZE;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// ============================================================================
// Types for GIF
// ============================================================================

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  title?: string;
}

export const chatMediaService = ChatMediaService.getInstance();
export default chatMediaService;

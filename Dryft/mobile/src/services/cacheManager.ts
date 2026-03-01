import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  version: number;
}

export interface CacheConfig {
  defaultTTL: number; // milliseconds
  maxSize: number; // max entries
  version: number;
}

export interface ImageCacheEntry {
  uri: string;
  localPath: string;
  size: number;
  cachedAt: number;
  lastAccessedAt: number;
}

type CacheCategory =
  | 'profiles'
  | 'matches'
  | 'messages'
  | 'discovery'
  | 'settings'
  | 'user'
  | 'misc';

// ============================================================================
// Constants
// ============================================================================

const CACHE_PREFIX = 'dryft_cache_';
const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory}images/`;
const IMAGE_CACHE_INDEX_KEY = 'dryft_image_cache_index';

const DEFAULT_TTL: Record<CacheCategory, number> = {
  profiles: 30 * 60 * 1000, // 30 minutes
  matches: 5 * 60 * 1000, // 5 minutes
  messages: 60 * 1000, // 1 minute
  discovery: 10 * 60 * 1000, // 10 minutes
  settings: 24 * 60 * 60 * 1000, // 24 hours
  user: 60 * 60 * 1000, // 1 hour
  misc: 15 * 60 * 1000, // 15 minutes
};

const MAX_IMAGE_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_CACHE_ENTRIES = 500;
const CACHE_VERSION = 1;

// ============================================================================
// Cache Manager
// ============================================================================

class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private imageCacheIndex: Map<string, ImageCacheEntry> = new Map();
  private totalImageCacheSize = 0;
  private initialized = false;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure image cache directory exists
    await this.ensureImageCacheDir();

    // Load image cache index
    await this.loadImageCacheIndex();

    // Clean expired entries
    await this.cleanExpiredEntries();

    this.initialized = true;
    console.log('[CacheManager] Initialized');
  }

  private async ensureImageCacheDir(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('[CacheManager] Failed to create image cache dir:', error);
    }
  }

  // ==========================================================================
  // Data Cache
  // ==========================================================================

  async set<T>(
    key: string,
    data: T,
    options: { category?: CacheCategory; ttl?: number } = {}
  ): Promise<void> {
    const { category = 'misc', ttl } = options;
    const actualTTL = ttl ?? DEFAULT_TTL[category];

    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + actualTTL,
      version: CACHE_VERSION,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in AsyncStorage
    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (error) {
      console.error('[CacheManager] Failed to persist cache:', error);
    }

    // Enforce size limits
    if (this.memoryCache.size > MAX_CACHE_ENTRIES) {
      await this.evictOldestEntries(Math.floor(MAX_CACHE_ENTRIES * 0.1));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (this.isEntryValid(memoryEntry)) {
        return memoryEntry.data as T;
      }
      this.memoryCache.delete(key);
    }

    // Check persistent cache
    try {
      const stored = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (this.isEntryValid(entry)) {
          // Restore to memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        }
        // Remove expired entry
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      }
    } catch (error) {
      console.error('[CacheManager] Failed to read cache:', error);
    }

    return null;
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { category?: CacheCategory; ttl?: number; forceRefresh?: boolean } = {}
  ): Promise<T> {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  async remove(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('[CacheManager] Failed to remove cache:', error);
    }
  }

  async removeByPrefix(prefix: string): Promise<void> {
    // Remove from memory
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Remove from storage
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(
        (k) => k.startsWith(`${CACHE_PREFIX}${prefix}`)
      );
      await AsyncStorage.multiRemove(keysToRemove);
    } catch (error) {
      console.error('[CacheManager] Failed to remove by prefix:', error);
    }
  }

  private isEntryValid<T>(entry: CacheEntry<T>): boolean {
    return entry.version === CACHE_VERSION && Date.now() < entry.expiresAt;
  }

  private async evictOldestEntries(count: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
      .slice(0, count);

    for (const [key] of entries) {
      await this.remove(key);
    }
  }

  private async cleanExpiredEntries(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));

      for (const storageKey of cacheKeys) {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const entry: CacheEntry<any> = JSON.parse(stored);
          if (!this.isEntryValid(entry)) {
            await AsyncStorage.removeItem(storageKey);
          }
        }
      }
    } catch (error) {
      console.error('[CacheManager] Failed to clean expired:', error);
    }
  }

  // ==========================================================================
  // Image Cache
  // ==========================================================================

  async cacheImage(remoteUri: string): Promise<string> {
    // Check if already cached
    const existing = this.imageCacheIndex.get(remoteUri);
    if (existing) {
      const fileInfo = await FileSystem.getInfoAsync(existing.localPath);
      if (fileInfo.exists) {
        // Update last accessed
        existing.lastAccessedAt = Date.now();
        return existing.localPath;
      }
      // File was deleted, remove from index
      this.imageCacheIndex.delete(remoteUri);
    }

    // Download and cache
    try {
      const filename = this.generateImageFilename(remoteUri);
      const localPath = `${IMAGE_CACHE_DIR}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(remoteUri, localPath);

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      const fileInfo = await FileSystem.getInfoAsync(localPath);
      const fileSize = (fileInfo as any).size || 0;

      // Add to index
      this.imageCacheIndex.set(remoteUri, {
        uri: remoteUri,
        localPath,
        size: fileSize,
        cachedAt: Date.now(),
        lastAccessedAt: Date.now(),
      });

      this.totalImageCacheSize += fileSize;

      // Check and enforce size limit
      await this.enforceImageCacheLimit();

      // Persist index
      await this.saveImageCacheIndex();

      return localPath;
    } catch (error) {
      console.error('[CacheManager] Image cache failed:', error);
      return remoteUri; // Return original URI on failure
    }
  }

  async getCachedImagePath(remoteUri: string): Promise<string | null> {
    const entry = this.imageCacheIndex.get(remoteUri);
    if (!entry) return null;

    const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
    if (!fileInfo.exists) {
      this.imageCacheIndex.delete(remoteUri);
      return null;
    }

    entry.lastAccessedAt = Date.now();
    return entry.localPath;
  }

  async prefetchImages(uris: string[]): Promise<void> {
    const promises = uris.map((uri) => this.cacheImage(uri).catch(() => null));
    await Promise.all(promises);
  }

  private generateImageFilename(uri: string): string {
    const hash = this.simpleHash(uri);
    const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
    return `${hash}.${extension}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async enforceImageCacheLimit(): Promise<void> {
    if (this.totalImageCacheSize <= MAX_IMAGE_CACHE_SIZE) return;

    // Sort by last accessed, oldest first
    const entries = Array.from(this.imageCacheIndex.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    // Remove oldest until under limit
    for (const [uri, entry] of entries) {
      if (this.totalImageCacheSize <= MAX_IMAGE_CACHE_SIZE * 0.8) break;

      try {
        await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
        this.totalImageCacheSize -= entry.size;
        this.imageCacheIndex.delete(uri);
      } catch (error) {
        console.error('[CacheManager] Failed to delete cached image:', error);
      }
    }

    await this.saveImageCacheIndex();
  }

  private async loadImageCacheIndex(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(IMAGE_CACHE_INDEX_KEY);
      if (stored) {
        const entries: ImageCacheEntry[] = JSON.parse(stored);
        this.totalImageCacheSize = 0;

        for (const entry of entries) {
          const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
          if (fileInfo.exists) {
            this.imageCacheIndex.set(entry.uri, entry);
            this.totalImageCacheSize += entry.size;
          }
        }
      }
    } catch (error) {
      console.error('[CacheManager] Failed to load image index:', error);
    }
  }

  private async saveImageCacheIndex(): Promise<void> {
    try {
      const entries = Array.from(this.imageCacheIndex.values());
      await AsyncStorage.setItem(IMAGE_CACHE_INDEX_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[CacheManager] Failed to save image index:', error);
    }
  }

  // ==========================================================================
  // Profile Caching Helpers
  // ==========================================================================

  async cacheProfile(profile: any): Promise<void> {
    await this.set(`profile_${profile.id}`, profile, { category: 'profiles' });

    // Cache profile images
    if (profile.photos?.length > 0) {
      const imageUris = profile.photos.map((p: any) => p.url);
      this.prefetchImages(imageUris).catch(() => {});
    }
  }

  async getCachedProfile(profileId: string): Promise<any | null> {
    return this.get(`profile_${profileId}`);
  }

  async cacheDiscoveryProfiles(profiles: any[]): Promise<void> {
    await this.set('discovery_profiles', profiles, { category: 'discovery' });

    // Cache all profile images
    const allImageUris = profiles.flatMap(
      (p) => p.photos?.map((photo: any) => photo.url) || []
    );
    this.prefetchImages(allImageUris).catch(() => {});
  }

  async getCachedDiscoveryProfiles(): Promise<any[] | null> {
    return this.get('discovery_profiles');
  }

  // ==========================================================================
  // Match/Message Caching Helpers
  // ==========================================================================

  async cacheMatches(matches: any[]): Promise<void> {
    await this.set('user_matches', matches, { category: 'matches' });
  }

  async getCachedMatches(): Promise<any[] | null> {
    return this.get('user_matches');
  }

  async cacheMessages(matchId: string, messages: any[]): Promise<void> {
    await this.set(`messages_${matchId}`, messages, { category: 'messages' });
  }

  async getCachedMessages(matchId: string): Promise<any[] | null> {
    return this.get(`messages_${matchId}`);
  }

  // ==========================================================================
  // User Data Caching
  // ==========================================================================

  async cacheUserData(userData: any): Promise<void> {
    await this.set('current_user', userData, { category: 'user' });
  }

  async getCachedUserData(): Promise<any | null> {
    return this.get('current_user');
  }

  // ==========================================================================
  // Cache Stats & Management
  // ==========================================================================

  async getCacheStats(): Promise<{
    memoryCacheSize: number;
    imageCacheSize: number;
    imageCacheCount: number;
  }> {
    return {
      memoryCacheSize: this.memoryCache.size,
      imageCacheSize: this.totalImageCacheSize,
      imageCacheCount: this.imageCacheIndex.size,
    };
  }

  async clearAll(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear data cache from storage
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('[CacheManager] Failed to clear storage cache:', error);
    }

    // Clear image cache
    try {
      await FileSystem.deleteAsync(IMAGE_CACHE_DIR, { idempotent: true });
      await this.ensureImageCacheDir();
      this.imageCacheIndex.clear();
      this.totalImageCacheSize = 0;
      await AsyncStorage.removeItem(IMAGE_CACHE_INDEX_KEY);
    } catch (error) {
      console.error('[CacheManager] Failed to clear image cache:', error);
    }

    trackEvent('cache_cleared', {
      manual: true,
    });
  }

  async clearImageCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(IMAGE_CACHE_DIR, { idempotent: true });
      await this.ensureImageCacheDir();
      this.imageCacheIndex.clear();
      this.totalImageCacheSize = 0;
      await AsyncStorage.removeItem(IMAGE_CACHE_INDEX_KEY);
    } catch (error) {
      console.error('[CacheManager] Failed to clear image cache:', error);
    }
  }
}

export const cacheManager = CacheManager.getInstance();
export default cacheManager;

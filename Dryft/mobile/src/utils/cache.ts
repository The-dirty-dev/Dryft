import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// In-Memory Cache
// =============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache(200);

// Periodic cleanup
setInterval(() => memoryCache.cleanup(), 60000);

// =============================================================================
// Persistent Cache (AsyncStorage)
// =============================================================================

const CACHE_PREFIX = '@dryft_cache_';

interface PersistentCacheEntry<T> {
  data: T;
  expiresAt: number;
  version: number;
}

const CACHE_VERSION = 1;

export const persistentCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;

      const entry: PersistentCacheEntry<T> = JSON.parse(raw);

      // Version check
      if (entry.version !== CACHE_VERSION) {
        await this.delete(key);
        return null;
      }

      // Expiration check
      if (Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    try {
      const entry: PersistentCacheEntry<T> = {
        data,
        expiresAt: Date.now() + ttlMs,
        version: CACHE_VERSION,
      };
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (error) {
      console.error('[Cache] Failed to persist:', error);
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
    } catch {
      // Ignore
    }
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('[Cache] Failed to clear:', error);
    }
  },
};

// =============================================================================
// API Response Cache
// =============================================================================

interface CacheConfig {
  key: string;
  ttlMs: number;
  persist?: boolean;
}

export async function withCache<T>(
  config: CacheConfig,
  fetcher: () => Promise<T>
): Promise<T> {
  const { key, ttlMs, persist = false } = config;

  // Check memory cache first
  const memCached = memoryCache.get<T>(key);
  if (memCached !== null) {
    return memCached;
  }

  // Check persistent cache
  if (persist) {
    const persistCached = await persistentCache.get<T>(key);
    if (persistCached !== null) {
      // Populate memory cache
      memoryCache.set(key, persistCached, ttlMs);
      return persistCached;
    }
  }

  // Fetch fresh data
  const data = await fetcher();

  // Cache the result
  memoryCache.set(key, data, ttlMs);
  if (persist) {
    await persistentCache.set(key, data, ttlMs);
  }

  return data;
}

// =============================================================================
// Cache Keys
// =============================================================================

export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  inventory: (userId: string) => `inventory:${userId}`,
  storeItems: (page: number) => `store:items:${page}`,
  matches: (userId: string) => `matches:${userId}`,
  conversations: (userId: string) => `conversations:${userId}`,
  avatarState: (userId: string) => `avatar:${userId}`,
};

// =============================================================================
// Cache TTL Constants
// =============================================================================

export const CacheTTL = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
};

import { createClient, RedisClientType } from 'redis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// Redis Client
// =============================================================================

let client: RedisClientType | null = null;
let isConnected = false;

/**
 * Initialize Redis connection.
 */
export async function initializeCache(): Promise<void> {
  if (client) return;

  const redisUrl = config.redis?.url || process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn('Redis URL not configured - caching disabled');
    return;
  }

  try {
    client = createClient({ url: redisUrl });

    client.on('error', (err) => {
      logger.error('Redis client error:', err);
      isConnected = false;
    });

    client.on('connect', () => {
      logger.info('Redis connected');
      isConnected = true;
    });

    client.on('disconnect', () => {
      logger.warn('Redis disconnected');
      isConnected = false;
    });

    await client.connect();
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    client = null;
  }
}

/**
 * Check if cache is available.
 */
export function isCacheAvailable(): boolean {
  return client !== null && isConnected;
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Get a cached value.
 */
export async function get<T>(key: string): Promise<T | null> {
  if (!client || !isConnected) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.debug(`Cache get error for ${key}:`, error);
    return null;
  }
}

/**
 * Set a cached value with optional TTL (in seconds).
 */
export async function set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  if (!client || !isConnected) return false;

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.debug(`Cache set error for ${key}:`, error);
    return false;
  }
}

/**
 * Delete a cached value.
 */
export async function del(key: string): Promise<boolean> {
  if (!client || !isConnected) return false;

  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.debug(`Cache delete error for ${key}:`, error);
    return false;
  }
}

/**
 * Delete all keys matching a pattern.
 */
export async function delPattern(pattern: string): Promise<number> {
  if (!client || !isConnected) return 0;

  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;
    return await client.del(keys);
  } catch (error) {
    logger.debug(`Cache delete pattern error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if a key exists.
 */
export async function exists(key: string): Promise<boolean> {
  if (!client || !isConnected) return false;

  try {
    return (await client.exists(key)) === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Set TTL on an existing key.
 */
export async function expire(key: string, ttlSeconds: number): Promise<boolean> {
  if (!client || !isConnected) return false;

  try {
    return await client.expire(key, ttlSeconds);
  } catch (error) {
    return false;
  }
}

/**
 * Increment a numeric value.
 */
export async function incr(key: string): Promise<number | null> {
  if (!client || !isConnected) return null;

  try {
    return await client.incr(key);
  } catch (error) {
    return null;
  }
}

// =============================================================================
// Cache-Aside Pattern Helper
// =============================================================================

/**
 * Get a value from cache or compute it if not cached.
 * Implements the cache-aside pattern.
 *
 * @param key - Cache key
 * @param compute - Function to compute the value if not cached
 * @param ttlSeconds - TTL in seconds (optional)
 * @returns The cached or computed value
 */
export async function getOrSet<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  // Try to get from cache first
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Compute the value
  const value = await compute();

  // PERF-008: Cache the result (fire and forget, but log errors)
  set(key, value, ttlSeconds).catch((err) => {
    logger.warn('Cache set failed in getOrSet', { key, error: err.message });
  });

  return value;
}

// =============================================================================
// Cache Key Builders
// =============================================================================

export const CacheKeys = {
  // User-related keys
  user: (userId: string) => `user:${userId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  userPreferences: (userId: string) => `user:preferences:${userId}`,

  // Discovery/matching keys
  discoverProfiles: (userId: string, page: number) => `discover:${userId}:${page}`,

  // Store/marketplace keys
  storeItems: (type?: string, page?: number) => `store:items:${type || 'all'}:${page || 0}`,
  storeItem: (itemId: string) => `store:item:${itemId}`,
  featuredItems: () => 'store:featured',

  // Conversation keys
  conversationMessages: (conversationId: string, page: number) =>
    `conv:messages:${conversationId}:${page}`,

  // Stats/aggregates
  userStats: (userId: string) => `stats:user:${userId}`,
  platformStats: () => 'stats:platform',

  // Session keys
  onlineUsers: () => 'online:users',
  userSessions: (userId: string) => `sessions:${userId}`,
};

// =============================================================================
// TTL Constants (in seconds)
// =============================================================================

export const CacheTTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400, // 24 hours
};

// =============================================================================
// Invalidation Helpers
// =============================================================================

/**
 * Invalidate all cache entries for a user.
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    del(CacheKeys.user(userId)),
    del(CacheKeys.userProfile(userId)),
    del(CacheKeys.userPreferences(userId)),
    del(CacheKeys.userStats(userId)),
    delPattern(`discover:${userId}:*`),
  ]);
}

/**
 * Invalidate store item cache.
 */
export async function invalidateStoreCache(itemId?: string): Promise<void> {
  if (itemId) {
    await del(CacheKeys.storeItem(itemId));
  }
  await del(CacheKeys.featuredItems());
  await delPattern('store:items:*');
}

/**
 * Invalidate conversation cache.
 */
export async function invalidateConversationCache(conversationId: string): Promise<void> {
  await delPattern(`conv:messages:${conversationId}:*`);
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

export async function closeCache(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    isConnected = false;
    logger.info('Redis connection closed');
  }
}

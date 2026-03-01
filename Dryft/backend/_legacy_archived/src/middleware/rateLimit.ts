import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import { Request } from 'express';
import { logger } from '../utils/logger.js';

// =============================================================================
// ARCH-005: Centralized Rate Limit Configuration
// =============================================================================

/**
 * Rate limit configuration interface for easy tracking and modification.
 */
interface RateLimitConfig {
  name: string;
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: 'ip' | 'ip+email' | 'userId' | ((req: Request) => string);
  skipLogging?: boolean;
}

/**
 * Centralized rate limit configurations.
 * All rate limits are defined here for easy tracking and modification.
 */
export const RATE_LIMIT_CONFIG: Record<string, RateLimitConfig> = {
  // Authentication & Security
  auth: {
    name: 'Authentication',
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    keyGenerator: 'ip+email',
  },
  password: {
    name: 'Password Operations',
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many password change attempts. Please try again later.',
    keyGenerator: 'ip',
  },
  verification: {
    name: 'Verification',
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many verification attempts. Please try again later.',
    keyGenerator: 'ip',
  },

  // User Actions
  message: {
    name: 'Messaging',
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: "Slow down! You're sending messages too quickly.",
    keyGenerator: 'ip',
    skipLogging: true, // Don't log normal rate limiting for messages
  },
  swipe: {
    name: 'Swiping',
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: 'Slow down! Take your time reviewing profiles.',
    keyGenerator: 'ip',
    skipLogging: true,
  },
  search: {
    name: 'Search',
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many search requests. Please slow down.',
    keyGenerator: 'ip',
    skipLogging: true,
  },

  // Resource Operations
  upload: {
    name: 'Upload',
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: 'Too many uploads. Please try again later.',
    keyGenerator: 'ip',
  },
  purchase: {
    name: 'Purchase',
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many purchase attempts. Please wait a moment.',
    keyGenerator: 'ip',
  },

  // Admin Operations
  adminAction: {
    name: 'Admin Actions',
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many admin actions. Please slow down.',
    keyGenerator: 'userId',
  },
};

// =============================================================================
// Rate Limit Factory
// =============================================================================

/**
 * Creates a rate limiter from a configuration key.
 */
function createFromConfig(configKey: string): RateLimitRequestHandler {
  const config = RATE_LIMIT_CONFIG[configKey];
  if (!config) {
    throw new Error(`Unknown rate limit config: ${configKey}`);
  }

  const retryAfter = Math.ceil(config.windowMs / 1000);

  const options: Partial<Options> = {
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: config.message,
      retryAfter,
    },
    standardHeaders: true,
    legacyHeaders: false,
  };

  // Set up key generator based on config
  if (config.keyGenerator) {
    if (config.keyGenerator === 'ip') {
      options.keyGenerator = (req) => req.ip || 'unknown';
    } else if (config.keyGenerator === 'ip+email') {
      options.keyGenerator = (req) => {
        const email = req.body?.email?.toLowerCase() || '';
        return `${req.ip}-${email}`;
      };
    } else if (config.keyGenerator === 'userId') {
      options.keyGenerator = (req) => (req as any).user?.id || req.ip || 'unknown';
    } else if (typeof config.keyGenerator === 'function') {
      options.keyGenerator = config.keyGenerator;
    }
  }

  // Set up handler with optional logging
  if (!config.skipLogging) {
    options.handler = (req, res, next, opts) => {
      const identifier = config.keyGenerator === 'userId'
        ? (req as any).user?.id || req.ip
        : req.ip;
      logger.warn(`${config.name} rate limit exceeded`, { identifier, configKey });
      res.status(429).json(opts.message);
    };
  }

  return rateLimit(options);
}

// =============================================================================
// Exported Rate Limiters
// =============================================================================

// Authentication & Security
export const authRateLimit = createFromConfig('auth');
export const passwordRateLimit = createFromConfig('password');
export const verificationRateLimit = createFromConfig('verification');

// User Actions
export const messageRateLimit = createFromConfig('message');
export const swipeRateLimit = createFromConfig('swipe');
export const searchRateLimit = createFromConfig('search');

// Resource Operations
export const uploadRateLimit = createFromConfig('upload');
export const purchaseRateLimit = createFromConfig('purchase');

// Admin Operations
export const adminActionRateLimit = createFromConfig('adminAction');

// =============================================================================
// Custom Rate Limiter Factory
// =============================================================================

/**
 * Create a custom rate limiter with specified options.
 * Use this for one-off rate limits not in the central config.
 */
export function createRateLimiter(options: Partial<Options>): RateLimitRequestHandler {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests. Please try again later.',
    },
    ...options,
  });
}

// =============================================================================
// Rate Limit Documentation Helper
// =============================================================================

/**
 * Returns a summary of all configured rate limits.
 * Useful for documentation and debugging.
 */
export function getRateLimitSummary(): Array<{
  key: string;
  name: string;
  window: string;
  max: number;
  keyGenerator: string;
}> {
  return Object.entries(RATE_LIMIT_CONFIG).map(([key, config]) => ({
    key,
    name: config.name,
    window: formatDuration(config.windowMs),
    max: config.max,
    keyGenerator: typeof config.keyGenerator === 'function'
      ? 'custom'
      : config.keyGenerator || 'ip',
  }));
}

function formatDuration(ms: number): string {
  if (ms >= 3600000) return `${ms / 3600000}h`;
  if (ms >= 60000) return `${ms / 60000}m`;
  return `${ms / 1000}s`;
}

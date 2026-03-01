import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// =============================================================================
// SEC-006: CSRF Protection Middleware
// =============================================================================

/**
 * CSRF token configuration
 */
const CSRF_CONFIG = {
  tokenLength: 32,
  headerName: 'x-csrf-token',
  cookieName: 'csrf_token',
  cookieOptions: {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
};

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Middleware to set CSRF token in cookie
 * Use this on GET requests that render forms
 */
export function setCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Check if we already have a valid token
  const existingToken = req.cookies?.[CSRF_CONFIG.cookieName];

  if (!existingToken) {
    const token = generateCsrfToken();
    res.cookie(CSRF_CONFIG.cookieName, token, CSRF_CONFIG.cookieOptions);
    (req as any).csrfToken = token;
  } else {
    (req as any).csrfToken = existingToken;
  }

  next();
}

/**
 * Middleware to validate CSRF token
 * Use this on state-changing requests (POST, PUT, PATCH, DELETE)
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF validation for:
  // 1. Safe HTTP methods (GET, HEAD, OPTIONS)
  // 2. Requests with Bearer token authentication (API calls from mobile apps)
  // 3. Webhook endpoints (verified via signature)

  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (safeMethod) {
    return next();
  }

  // Skip for Bearer token authenticated requests (mobile apps)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return next();
  }

  // Get token from cookie and header
  const cookieToken = req.cookies?.[CSRF_CONFIG.cookieName];
  const headerToken = req.headers[CSRF_CONFIG.headerName] as string;

  // Validate tokens exist and match
  if (!cookieToken || !headerToken) {
    logger.warn('CSRF token missing', {
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING',
    });
  }

  if (!safeCompare(cookieToken, headerToken)) {
    logger.warn('CSRF token mismatch', {
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'CSRF token invalid',
      code: 'CSRF_TOKEN_INVALID',
    });
  }

  next();
}

/**
 * Combined middleware that both sets and validates CSRF tokens
 * Sets token on safe methods, validates on unsafe methods
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

  if (safeMethod) {
    return setCsrfToken(req, res, next);
  } else {
    return validateCsrfToken(req, res, next);
  }
}

/**
 * Route handler to get a new CSRF token
 * Clients can call this endpoint to get a fresh token
 */
export function getCsrfTokenHandler(req: Request, res: Response): void {
  const token = generateCsrfToken();
  res.cookie(CSRF_CONFIG.cookieName, token, CSRF_CONFIG.cookieOptions);
  res.json({ csrf_token: token });
}

/**
 * Middleware factory to skip CSRF for specific paths
 */
export function csrfProtectionWithExclusions(excludePaths: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if path should be excluded
    const shouldExclude = excludePaths.some(path => {
      if (path.endsWith('*')) {
        return req.path.startsWith(path.slice(0, -1));
      }
      return req.path === path;
    });

    if (shouldExclude) {
      return next();
    }

    return csrfProtection(req, res, next);
  };
}

// =============================================================================
// Usage Notes
// =============================================================================
/*
 * For web-based admin panel or browser clients:
 *
 * 1. Add csrfProtection middleware to routes:
 *    app.use('/admin', csrfProtection, adminRoutes);
 *
 * 2. Or use with exclusions:
 *    app.use(csrfProtectionWithExclusions(['/api/webhooks/*', '/health']));
 *
 * 3. Add CSRF token endpoint for clients:
 *    app.get('/api/csrf-token', getCsrfTokenHandler);
 *
 * 4. Client-side: Include token in header for state-changing requests:
 *    fetch('/api/resource', {
 *      method: 'POST',
 *      headers: {
 *        'x-csrf-token': csrfToken,
 *      },
 *      credentials: 'include', // Important: include cookies
 *    });
 *
 * Note: This middleware automatically skips CSRF validation for:
 * - Requests using Bearer token authentication (mobile app API calls)
 * - Safe HTTP methods (GET, HEAD, OPTIONS)
 */

import * as Sentry from '@sentry/nextjs';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  ErrorCode,
  isRetryableError,
  getErrorCodeForStatus,
} from '@/types';

// =============================================================================
// Error Types
// =============================================================================

export interface AppError {
  type: ErrorCode;
  message: string;
  code?: string;
  status?: number;
  retryable: boolean;
  originalError?: Error;
}

/**
 * Classify an unknown error into a structured AppError.
 * Handles fetch errors, HTTP status errors, and generic exceptions.
 */
export function classifyError(error: unknown): AppError {
  // Handle Response objects (from fetch)
  if (error instanceof Response) {
    const errorCode = getErrorCodeForStatus(error.status);
    return {
      type: errorCode,
      message: ERROR_MESSAGES[errorCode],
      status: error.status,
      retryable: isRetryableError(errorCode),
    };
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Abort / timeout
    if (error.name === 'AbortError' || message.includes('timeout') || message.includes('aborted')) {
      return {
        type: ERROR_CODES.TIMEOUT,
        message: ERROR_MESSAGES.timeout,
        retryable: isRetryableError(ERROR_CODES.TIMEOUT),
        originalError: error,
      };
    }

    // Network errors (fetch failures, offline, DNS, etc.)
    if (
      error.name === 'TypeError' && message.includes('fetch') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('offline') ||
      message.includes('failed to fetch')
    ) {
      return {
        type: ERROR_CODES.NETWORK,
        message: ERROR_MESSAGES.network,
        retryable: isRetryableError(ERROR_CODES.NETWORK),
        originalError: error,
      };
    }

    // Auth errors
    if (
      message.includes('unauthorized') ||
      message.includes('401') ||
      message.includes('token')
    ) {
      return {
        type: ERROR_CODES.AUTH,
        message: ERROR_MESSAGES.auth,
        code: 'AUTH_EXPIRED',
        retryable: isRetryableError(ERROR_CODES.AUTH),
        originalError: error,
      };
    }

    // Server errors
    if (message.includes('500') || message.includes('server')) {
      return {
        type: ERROR_CODES.SERVER,
        message: ERROR_MESSAGES.server,
        retryable: isRetryableError(ERROR_CODES.SERVER),
        originalError: error,
      };
    }
  }

  // Unknown
  return {
    type: ERROR_CODES.UNKNOWN,
    message: ERROR_MESSAGES.unknown,
    retryable: isRetryableError(ERROR_CODES.UNKNOWN),
    originalError: error instanceof Error ? error : new Error(String(error)),
  };
}

// =============================================================================
// Retry Logic
// =============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [ERROR_CODES.NETWORK, ERROR_CODES.TIMEOUT, ERROR_CODES.SERVER],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap an async operation with automatic retry and exponential backoff.
 * Only retries errors classified as retryable (network, timeout, server).
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AppError | null = null;
  let delay = cfg.initialDelayMs;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = classifyError(error);

      if (!lastError.retryable || !cfg.retryableErrors.includes(lastError.type)) {
        throw lastError;
      }

      if (attempt === cfg.maxRetries) {
        throw lastError;
      }

      console.warn(
        `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries} failed (${lastError.type}), retrying in ${delay}ms...`,
      );

      await sleep(delay);
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError;
}

// =============================================================================
// Network State (browser)
// =============================================================================

/**
 * Check if the browser reports being online.
 * Falls back to true for SSR or unsupported environments.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

type NetworkCallback = (online: boolean) => void;

/**
 * Subscribe to browser online/offline events.
 * Returns an unsubscribe function.
 */
export function onNetworkChange(callback: NetworkCallback): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// =============================================================================
// User-Facing Error Messages
// =============================================================================

/**
 * Get a user-friendly message for an AppError.
 * Returns validation messages verbatim; maps other types to standard messages.
 */
export function getUserMessage(error: AppError): string {
  if (error.type === ERROR_CODES.VALIDATION && error.message) {
    return error.message;
  }
  return ERROR_MESSAGES[error.type] ?? ERROR_MESSAGES.unknown;
}

// =============================================================================
// Error Reporting
// =============================================================================

/**
 * Log and report an error with optional context.
 * Logs to console and forwards to Sentry when NEXT_PUBLIC_SENTRY_DSN is set.
 */
export function reportError(error: AppError, context?: Record<string, unknown>): void {
  const payload = {
    type: error.type,
    message: error.message,
    code: error.code,
    status: error.status,
    context,
    timestamp: new Date().toISOString(),
  };
  console.error('[ErrorReport]', payload);

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('error_type', error.type);

    if (error.code) {
      scope.setTag('error_code', error.code);
    }

    if (typeof error.status === 'number') {
      scope.setTag('http_status', String(error.status));
    }

    scope.setContext('app_error', payload as Record<string, unknown>);

    if (error.originalError) {
      Sentry.captureException(error.originalError);
      return;
    }

    Sentry.captureException(new Error(error.message));
  });
}

// =============================================================================
// Global Error Handlers
// =============================================================================

let globalHandlersInitialized = false;

/**
 * Install global window error and unhandled rejection handlers.
 * Call once during app initialization (e.g., in a root layout or Providers component).
 * Safe to call on the server — silently no-ops.
 */
export function initErrorHandling(): void {
  if (typeof window === 'undefined') return;
  if (globalHandlersInitialized) return;
  globalHandlersInitialized = true;

  window.addEventListener('error', (event) => {
    if (!event.error) return;
    const appError = classifyError(event.error);
    reportError(appError, { source: 'window.onerror', filename: event.filename });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const appError = classifyError(event.reason);
    reportError(appError, { source: 'unhandledrejection' });
  });
}

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';
import { captureException, addBreadcrumb, setTag } from './sentry';
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  ErrorCode,
  isRetryableError,
} from '../types';

// =============================================================================
// Error Types
// =============================================================================

export const ErrorType = ERROR_CODES;
export type ErrorType = ErrorCode;

export interface AppError {
  type: ErrorCode;
  message: string;
  code?: string;
  status?: number;
  retryable: boolean;
  originalError?: Error;
}

export function classifyError(error: unknown): AppError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('offline')
    ) {
      return {
        type: ERROR_CODES.NETWORK,
        message: ERROR_MESSAGES.network,
        retryable: isRetryableError(ERROR_CODES.NETWORK),
        originalError: error,
      };
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('aborted')) {
      return {
        type: ERROR_CODES.TIMEOUT,
        message: ERROR_MESSAGES.timeout,
        retryable: isRetryableError(ERROR_CODES.TIMEOUT),
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

  // Unknown error
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
  retryableErrors: ErrorType[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [ERROR_CODES.NETWORK, ERROR_CODES.TIMEOUT, ERROR_CODES.SERVER],
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AppError | null = null;
  let delay = cfg.initialDelayMs;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = classifyError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable || !cfg.retryableErrors.includes(lastError.type)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === cfg.maxRetries) {
        throw lastError;
      }

      console.log(
        `[Retry] Attempt ${attempt + 1}/${cfg.maxRetries} failed, retrying in ${delay}ms...`
      );

      // Wait before retry with exponential backoff
      await sleep(delay);
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Network State Management
// =============================================================================

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;

  // Actions
  updateState: (state: NetInfoState) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: true,
  connectionType: null,

  updateState: (state: NetInfoState) => {
    set({
      isConnected: state.isConnected ?? true,
      isInternetReachable: state.isInternetReachable,
      connectionType: state.type,
    });
  },
}));

// Initialize network listener
let unsubscribe: (() => void) | null = null;

export function initNetworkListener(): void {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener((state) => {
    useNetworkStore.getState().updateState(state);

    if (!state.isConnected) {
      console.log('[Network] Device went offline');
    } else if (state.isConnected && state.isInternetReachable === false) {
      console.log('[Network] Connected but no internet access');
    }
  });
}

export function stopNetworkListener(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

// =============================================================================
// Offline Queue
// =============================================================================

interface QueuedOperation {
  id: string;
  operation: () => Promise<unknown>;
  timestamp: number;
  retries: number;
}

interface OfflineQueueState {
  queue: QueuedOperation[];
  isProcessing: boolean;

  // Actions
  enqueue: (operation: () => Promise<unknown>) => string;
  dequeue: (id: string) => void;
  processQueue: () => Promise<void>;
  clearQueue: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set, get) => ({
  queue: [],
  isProcessing: false,

  enqueue: (operation: () => Promise<unknown>) => {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedOp: QueuedOperation = {
      id,
      operation,
      timestamp: Date.now(),
      retries: 0,
    };

    set((state) => ({ queue: [...state.queue, queuedOp] }));
    console.log(`[OfflineQueue] Enqueued operation ${id}`);

    // Try to process if we're online
    const networkState = useNetworkStore.getState();
    if (networkState.isConnected && networkState.isInternetReachable) {
      get().processQueue();
    }

    return id;
  },

  dequeue: (id: string) => {
    set((state) => ({
      queue: state.queue.filter((op) => op.id !== id),
    }));
  },

  processQueue: async () => {
    const { queue, isProcessing } = get();
    if (isProcessing || queue.length === 0) return;

    const networkState = useNetworkStore.getState();
    if (!networkState.isConnected) return;

    set({ isProcessing: true });

    for (const op of queue) {
      try {
        await withRetry(op.operation, { maxRetries: 2 });
        get().dequeue(op.id);
        console.log(`[OfflineQueue] Processed operation ${op.id}`);
      } catch (error) {
        const appError = classifyError(error);

        if (appError.type === ErrorType.NETWORK) {
          // Stop processing if we lost connection
          console.log('[OfflineQueue] Lost connection, stopping queue processing');
          break;
        }

        // Remove non-retryable operations
        if (!appError.retryable || op.retries >= 3) {
          get().dequeue(op.id);
          console.log(`[OfflineQueue] Removed failed operation ${op.id}`);
        } else {
          // Increment retry count
          set((state) => ({
            queue: state.queue.map((q) =>
              q.id === op.id ? { ...q, retries: q.retries + 1 } : q
            ),
          }));
        }
      }
    }

    set({ isProcessing: false });
  },

  clearQueue: () => {
    set({ queue: [], isProcessing: false });
  },
}));

// Auto-process queue when coming online
useNetworkStore.subscribe((state, prevState) => {
  if (state.isConnected && !prevState.isConnected) {
    console.log('[Network] Back online, processing queued operations');
    useOfflineQueueStore.getState().processQueue();
  }
});

// =============================================================================
// User-Facing Error Messages
// =============================================================================

export function getUserMessage(error: AppError): string {
  if (error.type === ERROR_CODES.VALIDATION && error.message) {
    return error.message;
  }
  return ERROR_MESSAGES[error.type] ?? ERROR_MESSAGES.unknown;
}

// =============================================================================
// Error Reporting (placeholder for analytics)
// =============================================================================

export function reportError(error: AppError, context?: Record<string, unknown>): void {
  console.error('[ErrorReport]', {
    type: error.type,
    message: error.message,
    code: error.code,
    status: error.status,
    context,
    timestamp: new Date().toISOString(),
  });

  // Send to Sentry
  setTag('error_type', error.type);
  setTag('error_code', error.code ?? error.type);

  addBreadcrumb(error.message, 'error', {
    type: error.type,
    retryable: error.retryable,
    ...context,
  });

  if (error.originalError) {
    captureException(error.originalError, {
      errorType: error.type,
      errorCode: error.code,
      retryable: error.retryable,
      ...context,
    });
  }
}

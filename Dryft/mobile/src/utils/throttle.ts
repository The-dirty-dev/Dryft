// =============================================================================
// Debounce
// =============================================================================

type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
};

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): DebouncedFunction<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debouncedFn = (...args: Parameters<T>): void => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs) {
        func(...lastArgs);
        lastArgs = null;
      }
    }, waitMs);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debouncedFn.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs) {
      func(...lastArgs);
      lastArgs = null;
    }
  };

  return debouncedFn;
}

// =============================================================================
// Throttle
// =============================================================================

type ThrottledFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): ThrottledFunction<T> {
  let lastRun = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttledFn = (...args: Parameters<T>): void => {
    const now = Date.now();
    const remaining = limitMs - (now - lastRun);

    lastArgs = args;

    if (remaining <= 0) {
      // Execute immediately
      lastRun = now;
      func(...args);
    } else if (!timeoutId) {
      // Schedule execution
      timeoutId = setTimeout(() => {
        lastRun = Date.now();
        timeoutId = null;
        if (lastArgs) {
          func(...lastArgs);
        }
      }, remaining);
    }
  };

  throttledFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttledFn;
}

// =============================================================================
// Request Deduplication
// =============================================================================

const pendingRequests = new Map<string, Promise<any>>();

export async function dedupeRequest<T>(
  key: string,
  request: () => Promise<T>
): Promise<T> {
  // Check if request is already in flight
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  // Execute request and track it
  const promise = request().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// =============================================================================
// Rate Limiter
// =============================================================================

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove old requests
    this.requests = this.requests.filter((t) => t > windowStart);

    return this.requests.length < this.config.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  async waitForSlot(): Promise<void> {
    while (!this.canMakeRequest()) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.config.windowMs - Date.now();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime + 10));
      }
      // Clean up old requests
      const windowStart = Date.now() - this.config.windowMs;
      this.requests = this.requests.filter((t) => t > windowStart);
    }
  }

  reset(): void {
    this.requests = [];
  }
}

// Pre-configured rate limiters
export const rateLimiters = {
  // API requests: 100 per minute
  api: new RateLimiter({ maxRequests: 100, windowMs: 60000 }),

  // Search requests: 10 per 10 seconds
  search: new RateLimiter({ maxRequests: 10, windowMs: 10000 }),

  // WebSocket messages: 50 per 10 seconds
  websocket: new RateLimiter({ maxRequests: 50, windowMs: 10000 }),
};

// =============================================================================
// Batch Requests
// =============================================================================

interface BatchConfig<T, R> {
  maxBatchSize: number;
  maxWaitMs: number;
  executor: (items: T[]) => Promise<Map<T, R>>;
}

export function createBatcher<T, R>(config: BatchConfig<T, R>) {
  let batch: T[] = [];
  let resolvers: Map<T, { resolve: (r: R) => void; reject: (e: Error) => void }> = new Map();
  let timeoutId: NodeJS.Timeout | null = null;

  const executeBatch = async () => {
    if (batch.length === 0) return;

    const currentBatch = batch;
    const currentResolvers = resolvers;
    batch = [];
    resolvers = new Map();
    timeoutId = null;

    try {
      const results = await config.executor(currentBatch);

      for (const [item, resolver] of currentResolvers) {
        const result = results.get(item);
        if (result !== undefined) {
          resolver.resolve(result);
        } else {
          resolver.reject(new Error('No result for item'));
        }
      }
    } catch (error) {
      for (const resolver of currentResolvers.values()) {
        resolver.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  return {
    add(item: T): Promise<R> {
      return new Promise((resolve, reject) => {
        batch.push(item);
        resolvers.set(item, { resolve, reject });

        if (batch.length >= config.maxBatchSize) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          executeBatch();
        } else if (!timeoutId) {
          timeoutId = setTimeout(executeBatch, config.maxWaitMs);
        }
      });
    },

    flush(): Promise<void> {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      return executeBatch();
    },
  };
}

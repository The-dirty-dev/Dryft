import { logger } from '../utils/logger.js';

// =============================================================================
// ARCH-007: Circuit Breaker Pattern
// Protects against cascading failures from external service calls
// =============================================================================

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation, requests pass through
  OPEN = 'OPEN',         // Failing, requests are blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Successes in half-open to close
  timeout: number;               // Time in ms before trying half-open
  resetTimeout?: number;         // Time in ms to reset failure count (sliding window)
}

/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  totalRequests: number;
  totalFailures: number;
}

/**
 * Default configurations for known services
 */
export const CIRCUIT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  stripe: {
    name: 'Stripe Payment',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    resetTimeout: 60000, // 1 minute sliding window
  },
  firebase: {
    name: 'Firebase Push',
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 15000, // 15 seconds
    resetTimeout: 60000,
  },
  s3: {
    name: 'AWS S3',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 60000,
  },
  redis: {
    name: 'Redis Cache',
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 10000, // 10 seconds
    resetTimeout: 30000,
  },
  email: {
    name: 'Email Service',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute (email services can be slow)
    resetTimeout: 120000,
  },
};

/**
 * Circuit breaker instance
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker ${this.config.name} entering HALF_OPEN state`);
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker ${this.config.name} is OPEN`,
          this.config.name
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Check if we can execute (without actually executing)
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.HALF_OPEN) return true;
    if (this.state === CircuitState.OPEN && this.shouldAttemptReset()) return true;
    return false;
  }

  /**
   * Get current circuit stats
   */
  getStats(): CircuitStats {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailureTime,
      lastSuccess: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = null;
    logger.info(`Circuit breaker ${this.config.name} manually reset`);
  }

  private onSuccess(): void {
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        logger.info(`Circuit breaker ${this.config.name} closed after recovery`);
      }
    } else {
      // Reset failure count on success in closed state (sliding window)
      if (this.config.resetTimeout && this.lastFailureTime) {
        const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
        if (timeSinceLastFailure > this.config.resetTimeout) {
          this.failures = 0;
        }
      }
    }
  }

  private onFailure(error: any): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = new Date();
    this.successes = 0; // Reset successes on any failure

    logger.warn(`Circuit breaker ${this.config.name} recorded failure`, {
      failures: this.failures,
      threshold: this.config.failureThreshold,
      state: this.state,
      error: error?.message,
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery attempt, go back to open
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
      logger.warn(`Circuit breaker ${this.config.name} reopened after failed recovery`);
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
      logger.error(`Circuit breaker ${this.config.name} OPENED after ${this.failures} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) return false;
    return Date.now() >= this.nextAttemptTime.getTime();
  }
}

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly serviceName: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

const circuitBreakers: Map<string, CircuitBreaker> = new Map();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    const config = CIRCUIT_CONFIGS[serviceName];
    if (!config) {
      // Create default config for unknown services
      circuitBreakers.set(serviceName, new CircuitBreaker({
        name: serviceName,
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 30000,
        resetTimeout: 60000,
      }));
    } else {
      circuitBreakers.set(serviceName, new CircuitBreaker(config));
    }
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<T> {
  const breaker = getCircuitBreaker(serviceName);
  return breaker.execute(fn);
}

/**
 * Check if a service circuit is available
 */
export function isServiceAvailable(serviceName: string): boolean {
  const breaker = getCircuitBreaker(serviceName);
  return breaker.canExecute();
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitStats(): CircuitStats[] {
  return Array.from(circuitBreakers.values()).map(cb => cb.getStats());
}

/**
 * Reset a specific circuit breaker
 */
export function resetCircuitBreaker(serviceName: string): void {
  const breaker = circuitBreakers.get(serviceName);
  if (breaker) {
    breaker.reset();
  }
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach(cb => cb.reset());
}

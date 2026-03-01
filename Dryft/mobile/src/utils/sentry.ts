import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Initialize Sentry error tracking.
 * Should be called early in app startup.
 */
export function initializeSentry(): void {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    release: Constants.expoConfig?.version
      ? `dryft-mobile@${Constants.expoConfig.version}`
      : undefined,
    dist: Constants.expoConfig?.extra?.eas?.buildNumber?.toString(),

    // Enable performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,

    // Don't send events in development by default
    enabled: !__DEV__,

    // Capture unhandled promise rejections
    enableAutoSessionTracking: true,

    // Configure what to send
    beforeSend(event) {
      // Don't send events without a message or exception
      if (!event.message && !event.exception) {
        return null;
      }
      return event;
    },

    // Integrations are auto-configured in @sentry/react-native 5.x
    // Tracing is enabled via tracesSampleRate above
  });

  console.log('[Sentry] Initialized successfully');
}

/**
 * Set the current user for error tracking context.
 */
export function setUser(user: { id: string; email?: string } | null): void {
  if (!SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture an exception and send to Sentry.
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): string {
  if (!SENTRY_DSN) {
    console.error('[Sentry disabled]', error);
    return '';
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message and send to Sentry.
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
): string {
  if (!SENTRY_DSN) {
    console.log(`[Sentry disabled] ${level}: ${message}`);
    return '';
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging.
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, unknown>
): void {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Set a tag for filtering in Sentry dashboard.
 */
export function setTag(key: string, value: string): void {
  if (!SENTRY_DSN) return;
  Sentry.setTag(key, value);
}

/**
 * Wrap a component with Sentry error boundary.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Performance monitoring - wrap navigation container.
 */
export const withSentryNavigationTracing = Sentry.withProfiler;

export default Sentry;

import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { analytics } from '../services/analytics';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  showDetails?: boolean;
  level?: 'screen' | 'component' | 'app';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// Default Theme Colors (fallback if theme context fails)
// ============================================================================

const defaultColors = {
  background: '#0a0a0f',
  surface: '#16161f',
  text: '#ffffff',
  textSecondary: '#8b8b9e',
  textMuted: '#5a5a6e',
  primary: '#e94560',
  error: '#ff4444',
  border: '#2a2a3e',
};

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static defaultProps = {
    showDetails: __DEV__,
    level: 'component',
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Track error in analytics
    analytics.trackError(error, {
      component_stack: errorInfo.componentStack?.substring(0, 1000),
      error_boundary_level: this.props.level,
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Log in development
    if (__DEV__) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.resetError);
        }
        return this.props.fallback;
      }

      // Default fallback based on level
      if (this.props.level === 'app') {
        return (
          <AppErrorScreen
            error={this.state.error!}
            errorInfo={this.state.errorInfo}
            onRetry={this.resetError}
            showDetails={this.props.showDetails}
          />
        );
      }

      if (this.props.level === 'screen') {
        return (
          <ScreenErrorView
            error={this.state.error!}
            onRetry={this.resetError}
            showDetails={this.props.showDetails}
          />
        );
      }

      // Component-level fallback
      return (
        <ComponentErrorView
          error={this.state.error!}
          onRetry={this.resetError}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// App-level Error Screen
// ============================================================================

interface AppErrorScreenProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  showDetails?: boolean;
}

function AppErrorScreen({ error, errorInfo, onRetry, showDetails }: AppErrorScreenProps) {
  return (
    <SafeAreaView style={[styles.appErrorContainer, { backgroundColor: defaultColors.background }]}>
      <View style={styles.appErrorContent}>
        {/* Logo */}
        <View style={[styles.logoContainer, { backgroundColor: defaultColors.primary }]}>
          <Text style={styles.logoText}>D</Text>
        </View>

        {/* Error Icon */}
        <View style={[styles.errorIconContainer, { backgroundColor: defaultColors.error + '20' }]}>
          <Ionicons name="warning" size={48} color={defaultColors.error} />
        </View>

        {/* Title */}
        <Text style={[styles.appErrorTitle, { color: defaultColors.text }]}>
          Something Went Wrong
        </Text>

        {/* Message */}
        <Text style={[styles.appErrorMessage, { color: defaultColors.textSecondary }]}>
          We're sorry, but something unexpected happened. Please try again or restart the app.
        </Text>

        {/* Error Details (Dev Mode) */}
        {showDetails && (
          <ScrollView
            style={[styles.errorDetails, { backgroundColor: defaultColors.surface }]}
            contentContainerStyle={styles.errorDetailsContent}
          >
            <Text style={[styles.errorName, { color: defaultColors.error }]}>
              {error.name}: {error.message}
            </Text>
            {error.stack && (
              <Text style={[styles.errorStack, { color: defaultColors.textMuted }]}>
                {error.stack.substring(0, 500)}
              </Text>
            )}
            {errorInfo?.componentStack && (
              <>
                <Text style={[styles.componentStackLabel, { color: defaultColors.textSecondary }]}>
                  Component Stack:
                </Text>
                <Text style={[styles.errorStack, { color: defaultColors.textMuted }]}>
                  {errorInfo.componentStack.substring(0, 500)}
                </Text>
              </>
            )}
          </ScrollView>
        )}

        {/* Actions */}
        <View style={styles.appErrorActions}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: defaultColors.primary }]}
            onPress={onRetry}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// Screen-level Error View
// ============================================================================

interface ScreenErrorViewProps {
  error: Error;
  onRetry: () => void;
  showDetails?: boolean;
}

function ScreenErrorView({ error, onRetry, showDetails }: ScreenErrorViewProps) {
  return (
    <View style={[styles.screenErrorContainer, { backgroundColor: defaultColors.background }]}>
      <View style={[styles.screenErrorIcon, { backgroundColor: defaultColors.error + '15' }]}>
        <Ionicons name="alert-circle" size={40} color={defaultColors.error} />
      </View>

      <Text style={[styles.screenErrorTitle, { color: defaultColors.text }]}>
        Unable to Load
      </Text>

      <Text style={[styles.screenErrorMessage, { color: defaultColors.textSecondary }]}>
        This screen couldn't be loaded. Please try again.
      </Text>

      {showDetails && (
        <View style={[styles.inlineError, { backgroundColor: defaultColors.surface }]}>
          <Text style={[styles.inlineErrorText, { color: defaultColors.error }]}>
            {error.name}: {error.message}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: defaultColors.primary }]}
        onPress={onRetry}
      >
        <Ionicons name="refresh" size={18} color="#fff" />
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// Component-level Error View
// ============================================================================

interface ComponentErrorViewProps {
  error: Error;
  onRetry: () => void;
  showDetails?: boolean;
}

function ComponentErrorView({ error, onRetry, showDetails }: ComponentErrorViewProps) {
  return (
    <View style={[styles.componentErrorContainer, { backgroundColor: defaultColors.surface }]}>
      <View style={styles.componentErrorContent}>
        <Ionicons name="warning-outline" size={24} color={defaultColors.error} />
        <View style={styles.componentErrorText}>
          <Text style={[styles.componentErrorTitle, { color: defaultColors.text }]}>
            Something went wrong
          </Text>
          {showDetails && (
            <Text
              style={[styles.componentErrorMessage, { color: defaultColors.textMuted }]}
              numberOfLines={2}
            >
              {error.message}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onRetry} style={styles.componentRetryButton}>
          <Ionicons name="refresh" size={20} color={defaultColors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// HOC for wrapping components
// ============================================================================

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

// ============================================================================
// Hook for error handling (for functional components)
// ============================================================================

import { useState, useCallback } from 'react';

interface UseErrorHandlerReturn {
  error: Error | null;
  handleError: (error: Error) => void;
  clearError: () => void;
  ErrorDisplay: React.FC;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error) => {
    setError(err);
    analytics.trackError(err, { source: 'useErrorHandler' });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const ErrorDisplay: React.FC = () => {
    if (!error) return null;

    return (
      <ComponentErrorView
        error={error}
        onRetry={clearError}
        showDetails={__DEV__}
      />
    );
  };

  return {
    error,
    handleError,
    clearError,
    ErrorDisplay,
  };
}

// ============================================================================
// Try-Catch wrapper for async operations
// ============================================================================

export async function tryCatch<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<[T, null] | [null, Error]> {
  try {
    const result = await operation();
    return [result, null];
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    analytics.trackError(err, context);
    return [null, err];
  }
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // App Error Screen
  appErrorContainer: {
    flex: 1,
  },
  appErrorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  errorIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  appErrorTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  appErrorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorDetails: {
    maxHeight: 200,
    width: '100%',
    borderRadius: 12,
    marginBottom: 24,
  },
  errorDetailsContent: {
    padding: 16,
  },
  errorName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  componentStackLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  appErrorActions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Screen Error View
  screenErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  screenErrorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  screenErrorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  screenErrorMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 21,
  },
  inlineError: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    maxWidth: '100%',
  },
  inlineErrorText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Component Error View
  componentErrorContainer: {
    borderRadius: 12,
    padding: 16,
    margin: 8,
  },
  componentErrorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  componentErrorText: {
    flex: 1,
  },
  componentErrorTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  componentErrorMessage: {
    fontSize: 12,
    marginTop: 2,
  },
  componentRetryButton: {
    padding: 8,
  },
});

export default ErrorBoundary;

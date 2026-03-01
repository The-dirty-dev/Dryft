import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useScreenSecurity, useScreenCaptureAlert } from '@hooks/useScreenSecurity';
import { screenSecurity, ScreenCaptureEvent } from '@services/screenSecurity';

// =============================================================================
// Theme Colors (matching app theme)
// =============================================================================

const colors = {
  background: '#0a0a0f',
  surface: '#16161f',
  text: '#ffffff',
  textSecondary: '#8b8b9e',
  primary: '#e94560',
  warning: '#ffaa00',
  overlay: 'rgba(10, 10, 15, 0.95)',
};

// =============================================================================
// SecureScreen Wrapper Component
// Wraps content and applies screen security protection
// =============================================================================

interface SecureScreenProps {
  children: ReactNode;
  /**
   * Force enable secure mode regardless of user settings
   */
  forceSecure?: boolean;
  /**
   * Show warning overlay when capture is detected
   */
  showCaptureWarning?: boolean;
  /**
   * Blur content when capture is detected instead of hiding
   */
  blurOnCapture?: boolean;
  /**
   * Custom blur intensity (1-100)
   */
  blurIntensity?: number;
  /**
   * Callback when capture is detected
   */
  onCaptureDetected?: (event: ScreenCaptureEvent) => void;
  /**
   * Custom warning message
   */
  warningMessage?: string;
  /**
   * Style for the container
   */
  style?: any;
}

export function SecureScreen({
  children,
  forceSecure = false,
  showCaptureWarning = true,
  blurOnCapture = true,
  blurIntensity = 100,
  onCaptureDetected,
  warningMessage,
  style,
}: SecureScreenProps) {
  const [showBlur, setShowBlur] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const { isCaptureActive, settings } = useScreenSecurity({
    forceSensitive: forceSecure,
    onCaptureDetected: (event) => {
      if (event.isCaptured) {
        setShowBlur(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowBlur(false));
      }
      onCaptureDetected?.(event);
    },
  });

  // Determine if we should show protection
  const shouldProtect = forceSecure || settings?.isEnabled;
  const shouldBlur = shouldProtect && blurOnCapture && isCaptureActive;

  return (
    <View style={[styles.container, style]}>
      {children}

      {/* Blur overlay when capture is detected */}
      {shouldBlur && showBlur && (
        <Animated.View style={[styles.blurContainer, { opacity: fadeAnim }]}>
          <BlurView intensity={blurIntensity} style={styles.blurView} tint="dark">
            {showCaptureWarning && (
              <View style={styles.warningContent}>
                <View style={styles.warningIconContainer}>
                  <Ionicons name="shield" size={48} color={colors.warning} />
                </View>
                <Text style={styles.warningTitle}>Content Protected</Text>
                <Text style={styles.warningMessage}>
                  {warningMessage ||
                    'Screen recording or capture detected. Content has been hidden to protect privacy.'}
                </Text>
              </View>
            )}
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
}

// =============================================================================
// ScreenCaptureWarning Modal Component
// Shows a modal warning when screen capture is detected
// =============================================================================

interface ScreenCaptureWarningProps {
  /**
   * Whether the warning is visible
   */
  visible: boolean;
  /**
   * Callback to dismiss the warning
   */
  onDismiss: () => void;
  /**
   * Custom message to display
   */
  message?: string;
  /**
   * Auto-dismiss after milliseconds (0 = no auto-dismiss)
   */
  autoDismissMs?: number;
}

export function ScreenCaptureWarning({
  visible,
  onDismiss,
  message,
  autoDismissMs = 5000,
}: ScreenCaptureWarningProps) {
  useEffect(() => {
    if (visible && autoDismissMs > 0) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [visible, autoDismissMs, onDismiss]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIconContainer}>
            <Ionicons name="eye-off" size={40} color={colors.warning} />
          </View>

          <Text style={styles.modalTitle}>Privacy Alert</Text>

          <Text style={styles.modalMessage}>
            {message ||
              'Screen recording or screenshot detected. For the safety and privacy of all users, this content is protected.'}
          </Text>

          <TouchableOpacity style={styles.modalButton} onPress={onDismiss}>
            <Text style={styles.modalButtonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// ScreenCaptureIndicator Component
// Shows a small indicator when screen capture is active
// =============================================================================

interface ScreenCaptureIndicatorProps {
  /**
   * Position of the indicator
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /**
   * Whether to show text or just an icon
   */
  compact?: boolean;
}

export function ScreenCaptureIndicator({
  position = 'top-right',
  compact = false,
}: ScreenCaptureIndicatorProps) {
  const { isCaptureActive } = useScreenSecurity();
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (isCaptureActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isCaptureActive, pulseAnim]);

  if (!isCaptureActive) return null;

  const positionStyle = {
    'top-left': { top: 50, left: 16 },
    'top-right': { top: 50, right: 16 },
    'bottom-left': { bottom: 100, left: 16 },
    'bottom-right': { bottom: 100, right: 16 },
  }[position];

  return (
    <Animated.View
      style={[
        styles.indicator,
        positionStyle,
        { opacity: pulseAnim },
      ]}
    >
      <Ionicons name="recording" size={16} color={colors.warning} />
      {!compact && <Text style={styles.indicatorText}>Recording</Text>}
    </Animated.View>
  );
}

// =============================================================================
// ProtectedContent Component
// Wrapper that hides specific content during capture
// =============================================================================

interface ProtectedContentProps {
  children: ReactNode;
  /**
   * Content to show when capture is detected
   */
  placeholder?: ReactNode;
  /**
   * Whether to blur instead of hide
   */
  blur?: boolean;
  /**
   * Blur intensity
   */
  blurIntensity?: number;
}

export function ProtectedContent({
  children,
  placeholder,
  blur = true,
  blurIntensity = 50,
}: ProtectedContentProps) {
  const { isCaptureActive, settings } = useScreenSecurity();

  const isProtected = settings?.isEnabled && isCaptureActive;

  if (!isProtected) {
    return <>{children}</>;
  }

  if (blur) {
    return (
      <View style={styles.protectedContainer}>
        {children}
        <BlurView intensity={blurIntensity} style={StyleSheet.absoluteFill} tint="dark" />
      </View>
    );
  }

  return (
    <>
      {placeholder || (
        <View style={styles.placeholderContainer}>
          <Ionicons name="lock-closed" size={24} color={colors.textSecondary} />
          <Text style={styles.placeholderText}>Content Hidden</Text>
        </View>
      )}
    </>
  );
}

// =============================================================================
// withSecureScreen HOC
// HOC to wrap any screen component with security
// =============================================================================

export function withSecureScreen<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<SecureScreenProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const SecureScreenWrapper = (props: P) => (
    <SecureScreen {...options}>
      <WrappedComponent {...props} />
    </SecureScreen>
  );

  SecureScreenWrapper.displayName = `withSecureScreen(${displayName})`;

  return SecureScreenWrapper;
}

// =============================================================================
// Styles
// =============================================================================

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Blur Overlay
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  blurView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningContent: {
    alignItems: 'center',
    padding: 32,
    maxWidth: 300,
  },
  warningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  warningMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.warning + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Indicator
  indicator: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    zIndex: 999,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },

  // Protected Content
  protectedContainer: {
    overflow: 'hidden',
  },
  placeholderContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default SecureScreen;

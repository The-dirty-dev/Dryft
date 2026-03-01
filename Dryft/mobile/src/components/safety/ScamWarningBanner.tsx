import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScamWarning } from '../../services/safety';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

interface ScamWarningBannerProps {
  warning: ScamWarning;
  onDismiss: () => void;
  onLearnMore?: () => void;
}

// ============================================================================
// Scam Warning Banner Component
// ============================================================================

export function ScamWarningBanner({
  warning,
  onDismiss,
  onLearnMore,
}: ScamWarningBannerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const getSeverityColor = () => {
    switch (warning.severity) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.textMuted;
      default:
        return colors.warning;
    }
  };

  const getSeverityIcon = () => {
    switch (warning.severity) {
      case 'high':
        return 'alert-circle';
      case 'medium':
        return 'warning';
      case 'low':
        return 'information-circle';
      default:
        return 'warning';
    }
  };

  const getWarningTitle = () => {
    switch (warning.type) {
      case 'financial_request':
        return 'Potential Scam Detected';
      case 'personal_info':
        return 'Privacy Warning';
      case 'external_link':
        return 'External Link Warning';
      case 'romance_scam':
        return 'Romance Scam Warning';
      case 'suspicious_behavior':
        return 'Suspicious Activity';
      default:
        return 'Safety Warning';
    }
  };

  const color = getSeverityColor();

  return (
    <Animated.View
      style={[
        styles.container,
        { borderLeftColor: color },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Ionicons name={getSeverityIcon()} size={24} color={color} />
        </View>

        <View style={styles.textContent}>
          <Text style={[styles.title, { color }]}>{getWarningTitle()}</Text>
          <Text style={styles.message}>{warning.message}</Text>
        </View>

        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {onLearnMore && (
        <TouchableOpacity style={styles.learnMoreButton} onPress={onLearnMore}>
          <Text style={styles.learnMoreText}>Learn more about staying safe</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.accent} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ============================================================================
// Inline Scam Warning (for chat)
// ============================================================================

interface InlineScamWarningProps {
  warning: ScamWarning;
  onDismiss: () => void;
}

export function InlineScamWarning({ warning, onDismiss }: InlineScamWarningProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = warning.severity === 'high' ? colors.error : colors.warning;

  return (
    <View style={[styles.inlineContainer, { borderColor: color }]}>
      <View style={styles.inlineHeader}>
        <Ionicons name="warning" size={16} color={color} />
        <Text style={[styles.inlineTitle, { color }]}>
          {warning.severity === 'high' ? 'Warning' : 'Caution'}
        </Text>
        <TouchableOpacity onPress={onDismiss} style={styles.inlineDismiss}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.inlineMessage}>{warning.message}</Text>
    </View>
  );
}

// ============================================================================
// Scam Detection Overlay
// ============================================================================

interface ScamDetectionOverlayProps {
  visible: boolean;
  warning: ScamWarning;
  onContinue: () => void;
  onBlock: () => void;
  onReport: () => void;
}

export function ScamDetectionOverlay({
  visible,
  warning,
  onContinue,
  onBlock,
  onReport,
}: ScamDetectionOverlayProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!visible) return null;

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayContent}>
        <View style={styles.overlayIcon}>
          <Ionicons name="shield-checkmark" size={48} color={colors.error} />
        </View>

        <Text style={styles.overlayTitle}>Safety Alert</Text>
        <Text style={styles.overlayMessage}>{warning.message}</Text>

        <View style={styles.overlayActions}>
          <TouchableOpacity style={styles.blockButton} onPress={onBlock}>
            <Ionicons name="ban" size={18} color={colors.text} />
            <Text style={styles.blockButtonText}>Block User</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportButton} onPress={onReport}>
            <Ionicons name="flag" size={18} color={colors.error} />
            <Text style={styles.reportButtonText}>Report</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>Continue Anyway</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // Banner
  container: {
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 12,
    borderLeftWidth: 4,
    margin: 16,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  dismissButton: {
    padding: 4,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  learnMoreText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },

  // Inline Warning
  inlineContainer: {
    backgroundColor: withAlpha(colors.warning, '1A'),
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginVertical: 8,
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  inlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  inlineDismiss: {
    padding: 2,
  },
  inlineMessage: {
    fontSize: 13,
    color: colors.textTertiary,
    lineHeight: 18,
  },

  // Overlay
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.background, 'E6'),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayContent: {
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  overlayIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withAlpha(colors.error, '33'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  overlayMessage: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  blockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  blockButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  reportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.error, '33'),
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  continueButton: {
    paddingVertical: 12,
  },
  continueButtonText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});

export default ScamWarningBanner;

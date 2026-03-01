import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScamWarning } from '../../services/safety';

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
  const getSeverityColor = () => {
    switch (warning.severity) {
      case 'high':
        return '#EF4444';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#6B7280';
      default:
        return '#F59E0B';
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
          <Ionicons name="close" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {onLearnMore && (
        <TouchableOpacity style={styles.learnMoreButton} onPress={onLearnMore}>
          <Text style={styles.learnMoreText}>Learn more about staying safe</Text>
          <Ionicons name="arrow-forward" size={14} color="#8B5CF6" />
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
  const color = warning.severity === 'high' ? '#EF4444' : '#F59E0B';

  return (
    <View style={[styles.inlineContainer, { borderColor: color }]}>
      <View style={styles.inlineHeader}>
        <Ionicons name="warning" size={16} color={color} />
        <Text style={[styles.inlineTitle, { color }]}>
          {warning.severity === 'high' ? 'Warning' : 'Caution'}
        </Text>
        <TouchableOpacity onPress={onDismiss} style={styles.inlineDismiss}>
          <Ionicons name="close" size={16} color="#6B7280" />
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
  if (!visible) return null;

  return (
    <View style={styles.overlayContainer}>
      <View style={styles.overlayContent}>
        <View style={styles.overlayIcon}>
          <Ionicons name="shield-checkmark" size={48} color="#EF4444" />
        </View>

        <Text style={styles.overlayTitle}>Safety Alert</Text>
        <Text style={styles.overlayMessage}>{warning.message}</Text>

        <View style={styles.overlayActions}>
          <TouchableOpacity style={styles.blockButton} onPress={onBlock}>
            <Ionicons name="ban" size={18} color="#fff" />
            <Text style={styles.blockButtonText}>Block User</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportButton} onPress={onReport}>
            <Ionicons name="flag" size={18} color="#EF4444" />
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

const styles = StyleSheet.create({
  // Banner
  container: {
    backgroundColor: '#1a1a1a',
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
    color: '#9CA3AF',
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
    borderTopColor: '#2a2a2a',
    gap: 6,
  },
  learnMoreText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },

  // Inline Warning
  inlineContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
    color: '#9CA3AF',
    lineHeight: 18,
  },

  // Overlay
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayContent: {
    backgroundColor: '#1a1a1a',
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
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  overlayMessage: {
    fontSize: 15,
    color: '#9CA3AF',
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
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  blockButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  reportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  continueButton: {
    paddingVertical: 12,
  },
  continueButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default ScamWarningBanner;

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { VersionInfo } from '../services/appUpdate';
import { useAppUpdate, useVersionInfo } from '../hooks/useAppUpdate';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Update Banner (non-blocking)
// ============================================================================

interface UpdateBannerProps {
  versionInfo: VersionInfo;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ versionInfo, onUpdate, onDismiss }: UpdateBannerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdate();
  };

  return (
    <View style={styles.banner}>
      <View style={styles.bannerContent}>
        <View style={styles.bannerIcon}>
          <Ionicons name="arrow-up-circle" size={24} color={colors.success} />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>Update Available</Text>
          <Text style={styles.bannerSubtitle}>
            Version {versionInfo.latestVersion} is ready
          </Text>
        </View>
      </View>
      <View style={styles.bannerActions}>
        <TouchableOpacity style={styles.bannerUpdateButton} onPress={handleUpdate}>
          <Text style={styles.bannerUpdateText}>Update</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bannerDismissButton} onPress={onDismiss}>
          <Ionicons name="close" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// Update Modal (optional updates)
// ============================================================================

interface UpdateModalProps {
  visible: boolean;
  versionInfo: VersionInfo;
  onUpdate: () => void;
  onSkip: () => void;
  onRemindLater: () => void;
}

export function UpdateModal({
  visible,
  versionInfo,
  onUpdate,
  onSkip,
  onRemindLater,
}: UpdateModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdate();
  };

  const isRecommended = versionInfo.updatePriority === 'recommended';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <LinearGradient
              colors={[colors.success, colors.like]}
              style={styles.modalIconGradient}
            >
              <Ionicons name="sparkles" size={32} color={colors.text} />
            </LinearGradient>
            <Text style={styles.modalTitle}>New Version Available</Text>
            <Text style={styles.modalVersion}>
              v{versionInfo.latestVersion}
            </Text>
          </View>

          {/* Release Notes */}
          {versionInfo.releaseNotes && (
            <View style={styles.releaseNotes}>
              <Text style={styles.releaseNotesTitle}>What's New</Text>
              <Text style={styles.releaseNotesText}>
                {versionInfo.releaseNotes}
              </Text>
            </View>
          )}

          {/* Priority Badge */}
          {isRecommended && (
            <View style={styles.recommendedBadge}>
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text style={styles.recommendedText}>Recommended Update</Text>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.remindButton} onPress={onRemindLater}>
              <Text style={styles.remindButtonText}>Remind Me Later</Text>
            </TouchableOpacity>

            {versionInfo.updatePriority === 'optional' && (
              <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
                <Text style={styles.skipButtonText}>Skip This Version</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Force Update Screen (required updates)
// ============================================================================

interface ForceUpdateScreenProps {
  versionInfo: VersionInfo;
  onUpdate: () => void;
}

export function ForceUpdateScreen({ versionInfo, onUpdate }: ForceUpdateScreenProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleUpdate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onUpdate();
  };

  return (
    <View style={styles.forceUpdateContainer}>
      <View style={styles.forceUpdateContent}>
        {/* Icon */}
        <View style={styles.forceUpdateIcon}>
          <LinearGradient
            colors={[colors.error, colors.panic]}
            style={styles.forceUpdateIconGradient}
          >
            <Ionicons name="warning" size={48} color={colors.text} />
          </LinearGradient>
        </View>

        {/* Text */}
        <Text style={styles.forceUpdateTitle}>Update Required</Text>
        <Text style={styles.forceUpdateMessage}>
          A critical update is required to continue using Dryft. Please update
          to version {versionInfo.latestVersion} to access the latest features
          and security improvements.
        </Text>

        {/* Current Version */}
        <View style={styles.versionCompare}>
          <View style={styles.versionItem}>
            <Text style={styles.versionLabel}>Current</Text>
            <Text style={styles.versionValue}>{versionInfo.currentVersion}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
          <View style={styles.versionItem}>
            <Text style={styles.versionLabel}>Required</Text>
            <Text style={[styles.versionValue, styles.versionRequired]}>
              {versionInfo.minimumVersion}
            </Text>
          </View>
        </View>

        {/* Update Button */}
        <TouchableOpacity style={styles.forceUpdateButton} onPress={handleUpdate}>
          <LinearGradient
            colors={[colors.accent, colors.accentSecondary]}
            style={styles.forceUpdateButtonGradient}
          >
            <Ionicons name="download" size={20} color={colors.text} />
            <Text style={styles.forceUpdateButtonText}>Update Now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================================
// Update Checker Component (auto-check on mount)
// ============================================================================

interface UpdateCheckerProps {
  children: React.ReactNode;
}

export function UpdateChecker({ children }: UpdateCheckerProps) {
  const {
    isUpdateRequired,
    shouldShowPrompt,
    versionInfo,
    skipVersion,
    remindLater,
    openStore,
  } = useAppUpdate(true);

  // Show force update screen for required updates
  if (isUpdateRequired && versionInfo) {
    return <ForceUpdateScreen versionInfo={versionInfo} onUpdate={openStore} />;
  }

  // Show update modal for optional updates
  if (shouldShowPrompt && versionInfo && !isUpdateRequired) {
    return (
      <>
        {children}
        <UpdateModal
          visible={shouldShowPrompt}
          versionInfo={versionInfo}
          onUpdate={openStore}
          onSkip={skipVersion}
          onRemindLater={remindLater}
        />
      </>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// Version Display Component
// ============================================================================

export function VersionDisplay() {
  const { currentVersion, buildNumber } = useVersionInfo();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.versionDisplay}>
      <Text style={styles.versionDisplayText}>
        Version {currentVersion} ({buildNumber})
      </Text>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const { width } = Dimensions.get('window');

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // Banner
  banner: {
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.success, '4D'),
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.success, '33'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerUpdateButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bannerUpdateText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  bannerDismissButton: {
    padding: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(colors.background, 'CC'),
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 20,
    padding: 24,
    width: width - 48,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  modalVersion: {
    fontSize: 15,
    color: colors.success,
    fontWeight: '600',
  },
  releaseNotes: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  releaseNotesText: {
    fontSize: 14,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(colors.warning, '33'),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 20,
    gap: 6,
  },
  recommendedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  updateButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  remindButton: {
    paddingVertical: 8,
  },
  remindButtonText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Force Update
  forceUpdateContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  forceUpdateContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  forceUpdateIcon: {
    marginBottom: 24,
  },
  forceUpdateIconGradient: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceUpdateTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  forceUpdateMessage: {
    fontSize: 16,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  versionCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 16,
  },
  versionItem: {
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  versionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  versionRequired: {
    color: colors.success,
  },
  forceUpdateButton: {
    width: '100%',
  },
  forceUpdateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  forceUpdateButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },

  // Version Display
  versionDisplay: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  versionDisplayText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});

export default UpdateChecker;

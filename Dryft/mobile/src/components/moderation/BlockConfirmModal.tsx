import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useBlockUser } from '../../hooks/useModeration';
import { BlockReason } from '../../services/moderation';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

interface BlockConfirmModalProps {
  visible: boolean;
  userId: string;
  userName: string;
  userPhoto?: string;
  onClose: () => void;
  onBlocked?: () => void;
  showReportOption?: boolean;
  onReport?: () => void;
}

// ============================================================================
// Block Confirm Modal Component
// ============================================================================

export function BlockConfirmModal({
  visible,
  userId,
  userName,
  userPhoto,
  onClose,
  onBlocked,
  showReportOption = true,
  onReport,
}: BlockConfirmModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isBlocked, isLoading, block, unblock, blockReasons } = useBlockUser(
    userId,
    userName,
    userPhoto
  );
  const [selectedReason, setSelectedReason] = useState<BlockReason | null>(null);
  const [step, setStep] = useState<'confirm' | 'reason' | 'success'>('confirm');

  const handleBlock = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('reason');
  };

  const handleSelectReason = async (reason: BlockReason) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedReason(reason);

    const success = await block(reason);
    if (success) {
      setStep('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleUnblock = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await unblock();
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setStep('confirm');
    onClose();
    if (step === 'success') {
      onBlocked?.();
    }
  };

  const handleReport = () => {
    handleClose();
    onReport?.();
  };

  // Already blocked - show unblock option
  if (isBlocked && step === 'confirm') {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.userInfo}>
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.userPhoto} />
              ) : (
                <View style={styles.userPhotoPlaceholder}>
                  <Ionicons name="person" size={32} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.userName}>{userName}</Text>
              <View style={styles.blockedBadge}>
                <Ionicons name="ban" size={14} color={colors.error} />
                <Text style={styles.blockedBadgeText}>Blocked</Text>
              </View>
            </View>

            <Text style={styles.unblockMessage}>
              {userName} is currently blocked. They can't see your profile or
              message you.
            </Text>

            <TouchableOpacity
              style={styles.unblockButton}
              onPress={handleUnblock}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.unblockButtonText}>Unblock {userName}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Step: Confirm */}
          {step === 'confirm' && (
            <>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={[colors.error, colors.panic]}
                  style={styles.iconGradient}
                >
                  <Ionicons name="ban" size={32} color={colors.text} />
                </LinearGradient>
              </View>

              <Text style={styles.title}>Block {userName}?</Text>
              <Text style={styles.message}>
                They won't be able to find your profile, see your photos, or
                message you. They won't be notified that you blocked them.
              </Text>

              <View style={styles.consequences}>
                <View style={styles.consequenceItem}>
                  <Ionicons name="eye-off" size={18} color={colors.textTertiary} />
                  <Text style={styles.consequenceText}>
                    They won't see your profile
                  </Text>
                </View>
                <View style={styles.consequenceItem}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={colors.textTertiary} />
                  <Text style={styles.consequenceText}>
                    They can't message you
                  </Text>
                </View>
                <View style={styles.consequenceItem}>
                  <Ionicons name="heart-dislike" size={18} color={colors.textTertiary} />
                  <Text style={styles.consequenceText}>
                    Any existing match will be removed
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.blockButton}
                onPress={handleBlock}
                disabled={isLoading}
              >
                <Text style={styles.blockButtonText}>Block</Text>
              </TouchableOpacity>

              {showReportOption && (
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={handleReport}
                >
                  <Ionicons name="flag" size={18} color={colors.error} />
                  <Text style={styles.reportButtonText}>Block and Report</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step: Select Reason */}
          {step === 'reason' && (
            <>
              <Text style={styles.reasonTitle}>Why are you blocking?</Text>
              <Text style={styles.reasonSubtitle}>
                This helps us improve Dryft (optional)
              </Text>

              <View style={styles.reasonsList}>
                {blockReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={styles.reasonItem}
                    onPress={() => handleSelectReason(reason.value)}
                    disabled={isLoading}
                  >
                    <Text style={styles.reasonLabel}>{reason.label}</Text>
                    {isLoading && selectedReason === reason.value ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => handleSelectReason('other')}
                disabled={isLoading}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              </View>

              <Text style={styles.successTitle}>{userName} Blocked</Text>
              <Text style={styles.successMessage}>
                They can no longer see your profile or contact you. You can
                unblock them anytime from your settings.
              </Text>

              <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(colors.background, 'CC'),
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  consequences: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  consequenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  consequenceText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  blockButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  blockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.error, '33'),
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 12,
    gap: 8,
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textTertiary,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  userPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(colors.error, '33'),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  blockedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  unblockMessage: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  unblockButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  unblockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  reasonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  reasonSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 20,
  },
  reasonsList: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
  reasonLabel: {
    fontSize: 15,
    color: colors.text,
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  doneButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});

export default BlockConfirmModal;

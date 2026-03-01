import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useReportUser } from '../../hooks/useModeration';
import { ReportReason } from '../../services/moderation';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

interface ReportModalProps {
  visible: boolean;
  userId: string;
  userName: string;
  userPhoto?: string;
  onClose: () => void;
  onReported?: () => void;
}

// ============================================================================
// Report Modal Component
// ============================================================================

export function ReportModal({
  visible,
  userId,
  userName,
  onClose,
  onReported,
}: ReportModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { report, isReporting, hasReported, reportReasons, error } = useReportUser(userId);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<'reason' | 'details' | 'success'>('reason');

  const handleSelectReason = (reason: ReportReason) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReason(reason);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await report(selectedReason, {
      description: description.trim() || undefined,
    });

    if (success) {
      setStep('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    setStep('reason');
    onClose();
    if (step === 'success') {
      onReported?.();
    }
  };

  const handleBack = () => {
    setStep('reason');
  };

  // Already reported
  if (hasReported && step === 'reason') {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Already Reported</Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.alreadyReported}>
              <View style={styles.alreadyReportedIcon}>
                <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              </View>
              <Text style={styles.alreadyReportedText}>
                You've already reported {userName}. Our team is reviewing your report.
              </Text>
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
              <Text style={styles.doneButtonText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            {step === 'details' && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <Text style={styles.title}>
              {step === 'success' ? 'Report Submitted' : `Report ${userName}`}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Step: Select Reason */}
          {step === 'reason' && (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={styles.subtitle}>
                Why are you reporting this user?
              </Text>

              <View style={styles.reasonsList}>
                {reportReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={styles.reasonItem}
                    onPress={() => handleSelectReason(reason.value)}
                  >
                    <View style={styles.reasonContent}>
                      <Text style={styles.reasonLabel}>{reason.label}</Text>
                      <Text style={styles.reasonDescription}>
                        {reason.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Step: Details */}
          {step === 'details' && selectedReason && (
            <View style={styles.content}>
              <View style={styles.selectedReasonBadge}>
                <Ionicons name="flag" size={16} color={colors.error} />
                <Text style={styles.selectedReasonText}>
                  {reportReasons.find((r) => r.value === selectedReason)?.label}
                </Text>
              </View>

              <Text style={styles.detailsLabel}>
                Additional details (optional)
              </Text>
              <TextInput
                style={styles.detailsInput}
                placeholder="Provide more context about what happened..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, isReporting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isReporting}
              >
                {isReporting ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color={colors.text} />
                    <Text style={styles.submitButtonText}>Submit Report</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                Your report will be reviewed by our Trust & Safety team. We may
                contact you for additional information.
              </Text>
            </View>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <View style={styles.successContent}>
              <LinearGradient
                colors={[colors.success, colors.like]}
                style={styles.successIcon}
              >
                <Ionicons name="checkmark" size={40} color={colors.text} />
              </LinearGradient>

              <Text style={styles.successTitle}>Thank You</Text>
              <Text style={styles.successMessage}>
                Your report has been submitted. Our Trust & Safety team will
                review it and take appropriate action.
              </Text>

              <View style={styles.successInfo}>
                <View style={styles.successInfoItem}>
                  <Ionicons name="time-outline" size={20} color={colors.accent} />
                  <Text style={styles.successInfoText}>
                    Reports are typically reviewed within 24 hours
                  </Text>
                </View>
                <View style={styles.successInfoItem}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
                  <Text style={styles.successInfoText}>
                    Your report is confidential
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const { height } = Dimensions.get('window');

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(colors.background, 'CC'),
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.backgroundDarkest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textTertiary,
    marginBottom: 20,
  },
  reasonsList: {
    gap: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  reasonDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  selectedReasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(colors.error, '33'),
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  selectedReasonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  detailsInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(colors.error, '33'),
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  successContent: {
    padding: 24,
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
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
  successInfo: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  successInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successInfoText: {
    fontSize: 14,
    color: colors.textTertiary,
    flex: 1,
  },
  doneButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  alreadyReported: {
    padding: 24,
    alignItems: 'center',
  },
  alreadyReportedIcon: {
    marginBottom: 16,
  },
  alreadyReportedText: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ReportModal;

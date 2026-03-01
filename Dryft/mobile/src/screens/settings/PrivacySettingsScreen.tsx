import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { analytics } from '../../services/analytics';
import { Input } from '../../components/common';
import {
  dataExportService,
  DataCategory,
  DataExportRequest,
} from '../../services/dataExport';
import {
  accountDeletionService,
  DeletionReason,
  DeletionRequest,
  AccountStatus,
} from '../../services/accountDeletion';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

interface PrivacySettings {
  showOnlineStatus: boolean;
  showLastActive: boolean;
  showReadReceipts: boolean;
  showTypingIndicator: boolean;
  allowProfileViews: boolean;
  allowLocationSharing: boolean;
  shareAnalytics: boolean;
  personalizedAds: boolean;
}

const DEFAULT_SETTINGS: PrivacySettings = {
  showOnlineStatus: true,
  showLastActive: true,
  showReadReceipts: true,
  showTypingIndicator: true,
  allowProfileViews: true,
  allowLocationSharing: true,
  shareAnalytics: true,
  personalizedAds: true,
};

// ============================================================================
// Main Component
// ============================================================================

export default function PrivacySettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);

  // Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);

  useEffect(() => {
    loadSettings();
    loadAccountStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('dryft_privacy_settings');
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccountStatus = async () => {
    const status = await accountDeletionService.getAccountStatus();
    setAccountStatus(status);
  };

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await AsyncStorage.setItem('dryft_privacy_settings', JSON.stringify(newSettings));

      // Update analytics consent if relevant
      if (key === 'shareAnalytics') {
        await analytics.setConsent(value);
      }
    } catch (error) {
      console.error('Failed to save privacy setting:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Account Status Alert */}
        {accountStatus?.deletionScheduled && accountStatus.deletionRequest && (
          <View style={[styles.alertBanner, { backgroundColor: theme.colors.error + '20' }]}>
            <Ionicons name="warning" size={24} color={theme.colors.error} />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: theme.colors.error }]}>
                Account Scheduled for Deletion
              </Text>
              <Text style={[styles.alertText, { color: theme.colors.textSecondary }]}>
                Your account will be deleted on{' '}
                {accountDeletionService.formatDeletionDate(
                  accountStatus.deletionRequest.gracePeriodEnds
                )}
              </Text>
              <TouchableOpacity
                style={[styles.alertButton, { borderColor: theme.colors.error }]}
                onPress={() => handleCancelDeletion(accountStatus.deletionRequest!.id)}
              >
                <Text style={[styles.alertButtonText, { color: theme.colors.error }]}>
                  Cancel Deletion
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {accountStatus?.pauseStatus?.isPaused && (
          <View style={[styles.alertBanner, { backgroundColor: theme.colors.warning + '20' }]}>
            <Ionicons name="pause-circle" size={24} color={theme.colors.warning} />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: theme.colors.warning }]}>
                Account Paused
              </Text>
              <Text style={[styles.alertText, { color: theme.colors.textSecondary }]}>
                Your profile is hidden from other users
              </Text>
              <TouchableOpacity
                style={[styles.alertButton, { borderColor: theme.colors.warning }]}
                onPress={handleResumeAccount}
              >
                <Text style={[styles.alertButtonText, { color: theme.colors.warning }]}>
                  Resume Account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Visibility Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            VISIBILITY
          </Text>

          <SettingRow
            title="Online Status"
            description="Show when you're active on Dryft"
            value={settings.showOnlineStatus}
            onValueChange={(v) => updateSetting('showOnlineStatus', v)}
            theme={theme}
          />

          <SettingRow
            title="Last Active"
            description="Show when you were last online"
            value={settings.showLastActive}
            onValueChange={(v) => updateSetting('showLastActive', v)}
            theme={theme}
          />

          <SettingRow
            title="Profile Views"
            description="Allow others to see when you view their profile"
            value={settings.allowProfileViews}
            onValueChange={(v) => updateSetting('allowProfileViews', v)}
            theme={theme}
          />
        </View>

        {/* Messaging Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            MESSAGING
          </Text>

          <SettingRow
            title="Read Receipts"
            description="Show when you've read messages"
            value={settings.showReadReceipts}
            onValueChange={(v) => updateSetting('showReadReceipts', v)}
            theme={theme}
          />

          <SettingRow
            title="Typing Indicator"
            description="Show when you're typing a message"
            value={settings.showTypingIndicator}
            onValueChange={(v) => updateSetting('showTypingIndicator', v)}
            theme={theme}
          />
        </View>

        {/* Data & Analytics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            DATA & ANALYTICS
          </Text>

          <SettingRow
            title="Share Analytics"
            description="Help improve Dryft by sharing usage data"
            value={settings.shareAnalytics}
            onValueChange={(v) => updateSetting('shareAnalytics', v)}
            theme={theme}
          />

          <SettingRow
            title="Personalized Ads"
            description="See ads tailored to your interests"
            value={settings.personalizedAds}
            onValueChange={(v) => updateSetting('personalizedAds', v)}
            theme={theme}
          />

          <SettingRow
            title="Location Sharing"
            description="Share your location for better matches"
            value={settings.allowLocationSharing}
            onValueChange={(v) => updateSetting('allowLocationSharing', v)}
            theme={theme}
          />
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            YOUR DATA
          </Text>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowExportModal(true)}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="download-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
                Export Your Data
              </Text>
              <Text style={[styles.actionDescription, { color: theme.colors.textSecondary }]}>
                Download a copy of your data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            ACCOUNT
          </Text>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowPauseModal(true)}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.warning + '20' }]}>
              <Ionicons name="pause-circle-outline" size={22} color={theme.colors.warning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
                Pause Account
              </Text>
              <Text style={[styles.actionDescription, { color: theme.colors.textSecondary }]}>
                Temporarily hide your profile
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowDeleteModal(true)}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.error + '20' }]}>
              <Ionicons name="trash-outline" size={22} color={theme.colors.error} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: theme.colors.error }]}>
                Delete Account
              </Text>
              <Text style={[styles.actionDescription, { color: theme.colors.textSecondary }]}>
                Permanently delete your account and data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Privacy Policy Link */}
        <TouchableOpacity style={styles.policyLink}>
          <Text style={[styles.policyText, { color: theme.colors.primary }]}>
            View Privacy Policy
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modals */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        theme={theme}
      />

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          setShowDeleteModal(false);
          loadAccountStatus();
        }}
        theme={theme}
      />

      <PauseAccountModal
        visible={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        onPaused={() => {
          setShowPauseModal(false);
          loadAccountStatus();
        }}
        theme={theme}
      />
    </SafeAreaView>
  );

  async function handleCancelDeletion(requestId: string) {
    Alert.alert(
      t('alerts.title.cancelAccountDeletion'),
      t('alerts.privacy.cancelDeletionMessage'),
      [
        { text: t('alerts.actions.no'), style: 'cancel' },
        {
          text: t('alerts.actions.yesKeep'),
          onPress: async () => {
            try {
              await accountDeletionService.cancelDeletion(requestId);
              await loadAccountStatus();
              Alert.alert(t('alerts.title.success'), t('alerts.privacy.cancelDeletionSuccess'));
            } catch (error) {
              Alert.alert(t('alerts.title.error'), t('alerts.privacy.cancelDeletionFailed'));
            }
          },
        },
      ]
    );
  }

  async function handleResumeAccount() {
    try {
      await accountDeletionService.resumeAccount();
      await loadAccountStatus();
      Alert.alert(t('alerts.title.welcomeBack'), t('alerts.privacy.reactivatedMessage'));
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.privacy.resumeFailed'));
    }
  }
}

// ============================================================================
// Setting Row Component
// ============================================================================

interface SettingRowProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  theme: any;
}

function SettingRow({ title, description, value, onValueChange, theme }: SettingRowProps) {
  return (
    <View style={[styles.settingRow, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor={theme.colors.text}
      />
    </View>
  );
}

// ============================================================================
// Export Modal
// ============================================================================

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
}

function ExportModal({ visible, onClose, theme }: ExportModalProps) {
  const { t } = useTranslation();
  const [selectedCategories, setSelectedCategories] = useState<Set<DataCategory>>(
    new Set(dataExportService.getAllCategories())
  );
  const [includeMedia, setIncludeMedia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportRequest, setExportRequest] = useState<DataExportRequest | null>(null);

  const toggleCategory = (category: DataCategory) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const request = await dataExportService.requestExport(
        Array.from(selectedCategories),
        'json',
        includeMedia
      );
      setExportRequest(request);
      Alert.alert(
        t('alerts.title.exportRequested'),
        t('alerts.privacy.exportRequestedMessage')
      );
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.privacy.exportRequestFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLocalExport = async () => {
    setLoading(true);
    try {
      const data = await dataExportService.exportLocalData();
      const fileUri = await dataExportService.saveLocalExport(data);
      await dataExportService.shareExport(fileUri);
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.privacy.localExportFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: withAlpha(theme.colors.text, '1A') }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.modalCancel, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Export Data</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
            Select the data you want to export. Processing may take up to 48 hours for large exports.
          </Text>

          {/* Category Selection */}
          <View style={styles.categoryList}>
            {dataExportService.getAllCategories().map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryItem,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: selectedCategories.has(category)
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
                onPress={() => toggleCategory(category)}
              >
                <Ionicons
                  name={selectedCategories.has(category) ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={
                    selectedCategories.has(category)
                      ? theme.colors.primary
                      : theme.colors.textMuted
                  }
                />
                <View style={styles.categoryInfo}>
                  <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                    {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                  </Text>
                  <Text
                    style={[styles.categoryDesc, { color: theme.colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {dataExportService.getCategoryDescription(category)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Include Media Toggle */}
          <View style={[styles.mediaToggle, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                Include Photos
              </Text>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                Include your uploaded photos (larger file size)
              </Text>
            </View>
            <Switch
              value={includeMedia}
              onValueChange={setIncludeMedia}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>

          {/* Export Buttons */}
          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleExport}
            disabled={loading || selectedCategories.size === 0}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <>
                <Ionicons name="cloud-download" size={20} color={theme.colors.text} />
                <Text style={[styles.exportButtonText, { color: theme.colors.text }]}>
                  Request Full Export
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.localExportButton, { borderColor: theme.colors.border }]}
            onPress={handleLocalExport}
            disabled={loading}
          >
            <Ionicons name="phone-portrait" size={20} color={theme.colors.text} />
            <Text style={[styles.localExportText, { color: theme.colors.text }]}>
              Export Local Data Only
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================================
// Delete Account Modal
// ============================================================================

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
  theme: any;
}

function DeleteAccountModal({ visible, onClose, onDeleted, theme }: DeleteAccountModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'reason' | 'confirm' | 'feedback'>('reason');
  const [selectedReason, setSelectedReason] = useState<DeletionReason | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const reasons = accountDeletionService.getDeletionReasons();

  const handleDelete = async () => {
    if (!selectedReason) return;

    setLoading(true);
    try {
      await accountDeletionService.requestDeletion(selectedReason, feedback);
      Alert.alert(
        t('alerts.title.accountDeletionScheduled'),
        t('alerts.privacy.deletionScheduledMessage', {
          days: accountDeletionService.getGracePeriodDays(),
        }),
        [{ text: t('alerts.actions.ok'), onPress: onDeleted }]
      );
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.privacy.deletionFailed'));
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep('reason');
    setSelectedReason(null);
    setFeedback('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: withAlpha(theme.colors.text, '1A') }]}>
          <TouchableOpacity onPress={resetAndClose}>
            <Text style={[styles.modalCancel, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete Account</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          {step === 'reason' && (
            <>
              <View style={[styles.warningBanner, { backgroundColor: theme.colors.error + '15' }]}>
                <Ionicons name="warning" size={24} color={theme.colors.error} />
                <Text style={[styles.warningText, { color: theme.colors.text }]}>
                  This action cannot be undone after the grace period. All your data, matches, and
                  messages will be permanently deleted.
                </Text>
              </View>

              <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
                Why are you leaving?
              </Text>

              <View style={styles.reasonList}>
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.reasonItem,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor:
                          selectedReason === reason.value
                            ? theme.colors.primary
                            : theme.colors.border,
                      },
                    ]}
                    onPress={() => setSelectedReason(reason.value)}
                  >
                    <Ionicons
                      name={
                        selectedReason === reason.value
                          ? 'radio-button-on'
                          : 'radio-button-off'
                      }
                      size={22}
                      color={
                        selectedReason === reason.value
                          ? theme.colors.primary
                          : theme.colors.textMuted
                      }
                    />
                    <View style={styles.reasonInfo}>
                      <Text style={[styles.reasonLabel, { color: theme.colors.text }]}>
                        {reason.label}
                      </Text>
                      <Text style={[styles.reasonDesc, { color: theme.colors.textMuted }]}>
                        {reason.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.continueButton,
                  {
                    backgroundColor: selectedReason ? theme.colors.error : theme.colors.border,
                  },
                ]}
                onPress={() => setStep('feedback')}
                disabled={!selectedReason}
              >
                <Text style={[styles.continueButtonText, { color: theme.colors.text }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'feedback' && (
            <>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep('reason')}
              >
                <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
                <Text style={[styles.backText, { color: theme.colors.text }]}>Back</Text>
              </TouchableOpacity>

              <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
                Any feedback for us?
              </Text>

              <Text style={[styles.feedbackHint, { color: theme.colors.textSecondary }]}>
                Optional - Help us improve Dryft for others
              </Text>

              <Input
                style={[
                  styles.feedbackInput,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="Share your thoughts..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                value={feedback}
                onChangeText={setFeedback}
                maxLength={500}
              />

              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
                onPress={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.text} />
                ) : (
                  <>
                    <Ionicons name="trash" size={20} color={theme.colors.text} />
                    <Text style={[styles.deleteButtonText, { color: theme.colors.text }]}>
                      Delete My Account
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={[styles.gracePeriodNote, { color: theme.colors.textMuted }]}>
                You'll have {accountDeletionService.getGracePeriodDays()} days to change your
                mind before your account is permanently deleted.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================================
// Pause Account Modal
// ============================================================================

interface PauseAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onPaused: () => void;
  theme: any;
}

function PauseAccountModal({ visible, onClose, onPaused, theme }: PauseAccountModalProps) {
  const { t } = useTranslation();
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const durations = [
    { value: 7, label: '1 week' },
    { value: 14, label: '2 weeks' },
    { value: 30, label: '1 month' },
    { value: undefined, label: 'Indefinitely' },
  ];

  const handlePause = async () => {
    setLoading(true);
    try {
      await accountDeletionService.pauseAccount(duration);
      Alert.alert(
        t('alerts.title.accountPaused'),
        t('alerts.privacy.accountPausedMessage'),
        [{ text: t('alerts.actions.ok'), onPress: onPaused }]
      );
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.privacy.pauseFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: withAlpha(theme.colors.text, '1A') }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.modalCancel, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Pause Account</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={[styles.infoBanner, { backgroundColor: theme.colors.primary + '15' }]}>
            <Ionicons name="information-circle" size={24} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              While paused, your profile won't be shown to others and you won't receive new
              matches. Your existing matches and messages will be preserved.
            </Text>
          </View>

          <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
            How long do you want to pause?
          </Text>

          <View style={styles.durationList}>
            {durations.map((d) => (
              <TouchableOpacity
                key={d.label}
                style={[
                  styles.durationItem,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor:
                      duration === d.value ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={() => setDuration(d.value)}
              >
                <Ionicons
                  name={duration === d.value ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={duration === d.value ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.durationLabel, { color: theme.colors.text }]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.pauseButton, { backgroundColor: theme.colors.warning }]}
            onPress={handlePause}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.textInverse} />
            ) : (
              <>
                <Ionicons name="pause" size={20} color={theme.colors.textInverse} />
                <Text style={[styles.pauseButtonText, { color: theme.colors.textInverse }]}>
                  Pause My Account
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  alertBanner: {
    flexDirection: 'row',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  alertText: {
    fontSize: 13,
    marginTop: 4,
  },
  alertButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  alertButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  policyLink: {
    padding: 16,
    alignItems: 'center',
  },
  policyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 40,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  categoryList: {
    gap: 8,
    marginBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
  },
  categoryDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  mediaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  localExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  localExportText: {
    fontSize: 16,
    fontWeight: '500',
  },
  warningBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  reasonList: {
    gap: 8,
    marginBottom: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  reasonInfo: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  reasonDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  continueButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  backText: {
    fontSize: 16,
  },
  feedbackHint: {
    fontSize: 14,
    marginBottom: 12,
  },
  feedbackInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    marginBottom: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  gracePeriodNote: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  durationList: {
    gap: 8,
    marginBottom: 20,
  },
  durationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  durationLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  pauseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

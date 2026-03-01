import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../../navigation';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/common';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
}

function SettingRow({ icon, label, value, onPress, showArrow = true, rightElement }: SettingRowProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {rightElement || (showArrow && onPress && (
        <Text style={styles.settingArrow}>›</Text>
      ))}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { user, logout, deleteAccount, isLoading } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleLogout = () => {
    Alert.alert(
      t('alerts.title.logout'),
      t('alerts.settings.logoutMessage'),
      [
        { text: t('alerts.actions.cancel'), style: 'cancel' },
        {
          text: t('alerts.actions.logout'),
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('alerts.title.deleteAccount'),
      t('alerts.settings.deleteAccountMessage'),
      [
        { text: t('alerts.actions.cancel'), style: 'cancel' },
        {
          text: t('alerts.actions.continue'),
          style: 'destructive',
          onPress: () => setShowDeleteModal(true),
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password');
      return;
    }

    setDeleteError(null);
    const result = await deleteAccount(deletePassword, deleteReason || undefined);

    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete account');
    } else {
      setShowDeleteModal(false);
      // The store will reset auth state, navigation will handle redirect
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletePassword('');
    setDeleteReason('');
    setDeleteError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="👤"
              label="Email"
              value={user?.email}
              showArrow={false}
            />
            <SettingRow
              icon="✅"
              label="Verification Status"
              value="Verified"
              showArrow={false}
            />
            <SettingRow
              icon="📜"
              label="Purchase History"
              onPress={() => {
                // Navigate to purchase history
              }}
            />
          </View>
        </View>

        {/* Haptics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Haptic Device</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="📳"
              label="Connected Device"
              value="Not connected"
              onPress={() => navigation.navigate('HapticSettings')}
            />
            <SettingRow
              icon="🎚️"
              label="Haptic Feedback"
              showArrow={false}
              rightElement={
                <Switch
                  value={hapticFeedback}
                  onValueChange={setHapticFeedback}
                  trackColor={{ false: colors.backgroundSecondary, true: withAlpha(colors.primary, '66') }}
                  thumbColor={hapticFeedback ? colors.primary : colors.textSecondary}
                />
              }
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="🔔"
              label="Push Notifications"
              showArrow={false}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: colors.backgroundSecondary, true: withAlpha(colors.primary, '66') }}
                  thumbColor={notificationsEnabled ? colors.primary : colors.textSecondary}
                />
              }
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security & Privacy</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="🔐"
              label="Security Settings"
              value="App Lock, Screen Security"
              onPress={() => navigation.navigate('SecuritySettings')}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="❓"
              label="Help Center"
              onPress={() => {
                // Open help center
              }}
            />
            <SettingRow
              icon="📧"
              label="Contact Support"
              onPress={() => {
                // Open email
              }}
            />
            <SettingRow
              icon="📝"
              label="Terms of Service"
              onPress={() => {
                // Open terms
              }}
            />
            <SettingRow
              icon="🔒"
              label="Privacy Policy"
              onPress={() => {
                // Open privacy policy
              }}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              icon="ℹ️"
              label="Version"
              value="1.0.0"
              showArrow={false}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Button
            title="Log Out"
            onPress={handleLogout}
            style={styles.logoutButton}
            textStyle={styles.logoutButtonText}
          />

          <Button
            title="Delete Account"
            onPress={handleDeleteAccount}
            style={styles.deleteButton}
            textStyle={styles.deleteButtonText}
          />
        </View>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            <Text style={styles.modalDescription}>
              Enter your password to permanently delete your account. This cannot be undone.
            </Text>

            <Input
              style={styles.modalInput}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
            />

            <Input
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Why are you leaving? (optional)"
              placeholderTextColor={colors.textSecondary}
              value={deleteReason}
              onChangeText={setDeleteReason}
              multiline
              numberOfLines={3}
            />

            {deleteError && (
              <Text style={styles.modalError}>{deleteError}</Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeDeleteModal}
                disabled={isLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={confirmDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: colors.surface,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  settingIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text,
  },
  settingValue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  actionsSection: {
    padding: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(colors.background, 'CC'),
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalError: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalDeleteText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

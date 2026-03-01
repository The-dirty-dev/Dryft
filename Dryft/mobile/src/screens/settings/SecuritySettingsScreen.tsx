import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import {
  biometricAuth,
  BiometricCapabilities,
  AppLockSettings,
  LOCK_TIMEOUT_OPTIONS,
} from '../../services/biometricAuth';
import { useScreenSecurity } from '@hooks/useScreenSecurity';
import { ScreenSecurityModule } from '@native/ScreenSecurityModule';
import { Input } from '../../components/common';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  disabled?: boolean;
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  onPress,
  showArrow,
  disabled,
}: SettingRowProps) {
  const theme = useTheme();

  const content = (
    <View
      style={[
        styles.settingRow,
        { borderBottomColor: theme.colors.divider },
        disabled && styles.settingRowDisabled,
      ]}
    >
      <View style={[styles.settingIcon, { backgroundColor: theme.colors.primary + '20' }]}>
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {onValueChange !== undefined && value !== undefined && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor={theme.colors.text}
        />
      )}
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export default function SecuritySettingsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [settings, setSettings] = useState<AppLockSettings | null>(null);
  const [capabilities, setCapabilities] = useState<BiometricCapabilities | null>(null);
  const [showPINModal, setShowPINModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [pinMode, setPinMode] = useState<'setup' | 'change' | 'remove'>('setup');

  // Screen security state
  const {
    settings: screenSecuritySettings,
    isSecure,
    updateSettings: updateScreenSecuritySettings,
    refreshSettings: refreshScreenSecuritySettings,
  } = useScreenSecurity({ autoEnable: false });
  const [isScreenSecurityAvailable] = useState(ScreenSecurityModule.isAvailable);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [appSettings, bioCapabilities] = await Promise.all([
      biometricAuth.getSettings(),
      biometricAuth.checkCapabilities(),
    ]);
    setSettings(appSettings);
    setCapabilities(bioCapabilities);
  };

  const handleAppLockToggle = async (enabled: boolean) => {
    if (enabled && !settings?.hasPIN) {
      // Need to set up PIN first
      setPinMode('setup');
      setShowPINModal(true);
      return;
    }

    await biometricAuth.setAppLockEnabled(enabled);
    loadSettings();
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      // Verify biometric works before enabling
      const result = await biometricAuth.authenticateWithBiometrics(
        'Enable biometric authentication'
      );
      if (!result.success) {
        Alert.alert(t('alerts.title.error'), t('alerts.security.biometricFailed'));
        return;
      }
    }

    await biometricAuth.setBiometricEnabled(enabled);
    loadSettings();
  };

  const handleChangePIN = () => {
    setPinMode('change');
    setShowPINModal(true);
  };

  const handleRemovePIN = async () => {
    Alert.alert(
      t('alerts.title.removePin'),
      t('alerts.security.removePinMessage'),
      [
        { text: t('alerts.actions.cancel'), style: 'cancel' },
        {
          text: t('alerts.actions.remove'),
          style: 'destructive',
          onPress: async () => {
            await biometricAuth.removePIN();
            await biometricAuth.setAppLockEnabled(false);
            await biometricAuth.setBiometricEnabled(false);
            loadSettings();
          },
        },
      ]
    );
  };

  const handleTimeoutSelect = async (timeout: number) => {
    await biometricAuth.setLockTimeout(timeout);
    setShowTimeoutModal(false);
    loadSettings();
  };

  // Screen security handlers
  const handleScreenSecurityToggle = async (enabled: boolean) => {
    try {
      await updateScreenSecuritySettings({ isEnabled: enabled });
      if (enabled) {
        Alert.alert(
          t('alerts.title.screenSecurityEnabled'),
          Platform.OS === 'android'
            ? t('alerts.security.screenSecurityEnabledAndroid')
            : t('alerts.security.screenSecurityEnabledIOS'),
          [{ text: t('alerts.actions.ok') }]
        );
      }
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.security.screenSecurityUpdateFailed'));
    }
  };

  const handleBlurOnCaptureToggle = async (enabled: boolean) => {
    try {
      await updateScreenSecuritySettings({ blurOnScreenshot: enabled });
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.security.blurUpdateFailed'));
    }
  };

  const handleNotifyOnCaptureToggle = async (enabled: boolean) => {
    try {
      await updateScreenSecuritySettings({ notifyOnScreenshot: enabled });
    } catch (error) {
      Alert.alert(t('alerts.title.error'), t('alerts.security.notifyUpdateFailed'));
    }
  };

  const showScreenSecurityInfo = () => {
    const platformMessage =
      Platform.OS === 'android'
        ? t('alerts.security.aboutScreenSecurityAndroid')
        : t('alerts.security.aboutScreenSecurityIOS');

    Alert.alert(
      t('alerts.title.aboutScreenSecurity'),
      t('alerts.security.aboutScreenSecurityMessage', { platformMessage }),
      [{ text: t('alerts.actions.gotIt') }]
    );
  };

  const getTimeoutLabel = (timeout: number): string => {
    switch (timeout) {
      case LOCK_TIMEOUT_OPTIONS.IMMEDIATE:
        return 'Immediately';
      case LOCK_TIMEOUT_OPTIONS.ONE_MINUTE:
        return '1 minute';
      case LOCK_TIMEOUT_OPTIONS.FIVE_MINUTES:
        return '5 minutes';
      case LOCK_TIMEOUT_OPTIONS.FIFTEEN_MINUTES:
        return '15 minutes';
      case LOCK_TIMEOUT_OPTIONS.ONE_HOUR:
        return '1 hour';
      case LOCK_TIMEOUT_OPTIONS.NEVER:
        return 'Never';
      default:
        return 'Unknown';
    }
  };

  const biometricName = capabilities ? biometricAuth.getBiometricName() : 'Biometrics';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* App Lock Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            APP LOCK
          </Text>

          <SettingRow
            icon="lock-closed"
            title="App Lock"
            subtitle="Require authentication to open app"
            value={settings?.isEnabled}
            onValueChange={handleAppLockToggle}
          />

          {settings?.isEnabled && (
            <>
              <SettingRow
                icon="time"
                title="Lock Timeout"
                subtitle={`Lock after ${getTimeoutLabel(settings?.lockTimeout || 0)}`}
                onPress={() => setShowTimeoutModal(true)}
                showArrow
              />

              {capabilities?.isAvailable && (
                <SettingRow
                  icon={capabilities.biometricType === 'facial' ? 'scan' : 'finger-print'}
                  title={biometricName}
                  subtitle={`Use ${biometricName} to unlock`}
                  value={settings?.biometricEnabled}
                  onValueChange={handleBiometricToggle}
                />
              )}
            </>
          )}
        </View>

        {/* PIN Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            PIN
          </Text>

          {settings?.hasPIN ? (
            <>
              <SettingRow
                icon="key"
                title="Change PIN"
                subtitle="Update your 4-digit PIN"
                onPress={handleChangePIN}
                showArrow
              />
              <SettingRow
                icon="trash"
                title="Remove PIN"
                subtitle="Delete your PIN (disables app lock)"
                onPress={handleRemovePIN}
                showArrow
              />
            </>
          ) : (
            <SettingRow
              icon="add-circle"
              title="Set Up PIN"
              subtitle="Create a 4-digit PIN"
              onPress={() => {
                setPinMode('setup');
                setShowPINModal(true);
              }}
              showArrow
            />
          )}
        </View>

        {/* Screen Security Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            SCREEN SECURITY
          </Text>

          <SettingRow
            icon="shield-checkmark"
            title="Screen Capture Protection"
            subtitle="Prevent screenshots and screen recording"
            value={screenSecuritySettings?.isEnabled}
            onValueChange={handleScreenSecurityToggle}
          />

          {screenSecuritySettings?.isEnabled && (
            <>
              <SettingRow
                icon="eye-off"
                title="Blur on Capture"
                subtitle="Blur content when screen capture is detected"
                value={screenSecuritySettings?.blurOnScreenshot ?? true}
                onValueChange={handleBlurOnCaptureToggle}
              />

              {Platform.OS === 'ios' && (
                <SettingRow
                  icon="notifications"
                  title="Capture Notifications"
                  subtitle="Alert when capture is detected"
                  value={screenSecuritySettings?.notifyOnScreenshot ?? true}
                  onValueChange={handleNotifyOnCaptureToggle}
                />
              )}

              <SettingRow
                icon="information-circle"
                title="How It Works"
                subtitle="Learn about screen security"
                onPress={showScreenSecurityInfo}
                showArrow
              />
            </>
          )}
        </View>

        {/* Screen Security Status */}
        {screenSecuritySettings?.isEnabled && (
          <View
            style={[
              styles.statusBox,
              {
                backgroundColor: isSecure
                  ? withAlpha(theme.colors.success, '1A')
                  : withAlpha(theme.colors.warning, '1A'),
              },
            ]}
          >
            <Ionicons
              name={isSecure ? 'shield-checkmark' : 'shield-outline'}
              size={20}
              color={isSecure ? theme.colors.success : theme.colors.warning}
            />
            <Text
              style={[
                styles.statusText,
                { color: isSecure ? theme.colors.success : theme.colors.warning },
              ]}
            >
              {isSecure
                ? 'Screen protection is active'
                : 'Protection will activate on sensitive screens'}
            </Text>
          </View>
        )}

        {/* Development Mode Warning */}
        {!isScreenSecurityAvailable && (
          <View style={[styles.infoBox, { backgroundColor: withAlpha(theme.colors.warning, '1A') }]}>
            <Ionicons name="warning" size={20} color={theme.colors.warning} />
            <Text style={[styles.infoText, { color: theme.colors.warning }]}>
              Screen security requires a development build. It won't work in Expo Go.
            </Text>
          </View>
        )}

        {/* Info Section */}
        <View style={[styles.infoBox, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            App Lock protects your account if someone else has access to your device.
            Your data is always encrypted.
          </Text>
        </View>
      </ScrollView>

      {/* PIN Setup Modal */}
      <PINSetupModal
        visible={showPINModal}
        mode={pinMode}
        onClose={() => setShowPINModal(false)}
        onSuccess={() => {
          setShowPINModal(false);
          loadSettings();
          if (pinMode === 'setup') {
            biometricAuth.setAppLockEnabled(true);
          }
        }}
      />

      {/* Timeout Selection Modal */}
      <TimeoutModal
        visible={showTimeoutModal}
        currentTimeout={settings?.lockTimeout || 0}
        onSelect={handleTimeoutSelect}
        onClose={() => setShowTimeoutModal(false)}
      />
    </SafeAreaView>
  );
}

// PIN Setup Modal Component
interface PINSetupModalProps {
  visible: boolean;
  mode: 'setup' | 'change' | 'remove';
  onClose: () => void;
  onSuccess: () => void;
}

function PINSetupModal({ visible, mode, onClose, onSuccess }: PINSetupModalProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('new');
  const [currentPIN, setCurrentPIN] = useState('');
  const [newPIN, setNewPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(mode === 'change' ? 'current' : 'new');
      setCurrentPIN('');
      setNewPIN('');
      setConfirmPIN('');
      setError(null);
    }
  }, [visible, mode]);

  const handleSubmit = async () => {
    setError(null);

    if (step === 'current') {
      const result = await biometricAuth.authenticateWithPIN(currentPIN);
      if (result.success) {
        setStep('new');
        setCurrentPIN('');
      } else {
        setError(result.error || 'Incorrect PIN');
      }
      return;
    }

    if (step === 'new') {
      if (newPIN.length < 4) {
        setError('PIN must be 4 digits');
        return;
      }
      setStep('confirm');
      return;
    }

    if (step === 'confirm') {
      if (confirmPIN !== newPIN) {
        setError('PINs do not match');
        setConfirmPIN('');
        return;
      }

      try {
        await biometricAuth.setupPIN(newPIN);
        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to set PIN');
      }
    }
  };

  const currentValue =
    step === 'current' ? currentPIN : step === 'new' ? newPIN : confirmPIN;
  const setCurrentValue =
    step === 'current' ? setCurrentPIN : step === 'new' ? setNewPIN : setConfirmPIN;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            {step === 'current'
              ? 'Enter Current PIN'
              : step === 'new'
              ? 'Create New PIN'
              : 'Confirm PIN'}
          </Text>

          <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
            {step === 'current'
              ? 'Enter your current PIN to continue'
              : step === 'new'
              ? 'Enter a 4-digit PIN'
              : 'Re-enter your PIN to confirm'}
          </Text>

          <Input
            style={[
              styles.pinInput,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: error ? theme.colors.error : theme.colors.border,
              },
            ]}
            value={currentValue}
            onChangeText={setCurrentValue}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            autoFocus
          />

          {error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
            disabled={currentValue.length < 4}
          >
            <Text style={[styles.submitButtonText, { color: theme.colors.text }]}>
              {step === 'confirm' ? 'Set PIN' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Timeout Selection Modal
interface TimeoutModalProps {
  visible: boolean;
  currentTimeout: number;
  onSelect: (timeout: number) => void;
  onClose: () => void;
}

function TimeoutModal({ visible, currentTimeout, onSelect, onClose }: TimeoutModalProps) {
  const theme = useTheme();

  const options = [
    { value: LOCK_TIMEOUT_OPTIONS.IMMEDIATE, label: 'Immediately' },
    { value: LOCK_TIMEOUT_OPTIONS.ONE_MINUTE, label: '1 minute' },
    { value: LOCK_TIMEOUT_OPTIONS.FIVE_MINUTES, label: '5 minutes' },
    { value: LOCK_TIMEOUT_OPTIONS.FIFTEEN_MINUTES, label: '15 minutes' },
    { value: LOCK_TIMEOUT_OPTIONS.ONE_HOUR, label: '1 hour' },
    { value: LOCK_TIMEOUT_OPTIONS.NEVER, label: 'Never' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Lock Timeout
          </Text>
          <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
            Lock app after being in background for:
          </Text>

          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[
                styles.optionRow,
                { borderBottomColor: theme.colors.divider },
              ]}
            >
              <Text style={[styles.optionText, { color: theme.colors.text }]}>
                {option.label}
              </Text>
              {currentTimeout === option.value && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  pinInput: {
    fontSize: 24,
    textAlign: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    letterSpacing: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
  },
});

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { useOnboardingStore, getStepProgress } from '../../store/onboardingStore';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

interface Permission {
  id: keyof ReturnType<typeof useOnboardingStore.getState>['permissionsGranted'];
  icon: string;
  title: string;
  description: string;
  required: boolean;
}

const PERMISSIONS: Permission[] = [
  {
    id: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    description: 'Get notified when you have new matches and messages',
    required: false,
  },
  {
    id: 'camera',
    icon: '📷',
    title: 'Camera',
    description: 'Take photos for your profile and video calls',
    required: true,
  },
  {
    id: 'microphone',
    icon: '🎤',
    title: 'Microphone',
    description: 'Required for voice chat in VR and video calls',
    required: true,
  },
  {
    id: 'location',
    icon: '📍',
    title: 'Location',
    description: 'Find people near you (city-level only, never exact)',
    required: false,
  },
];

export default function PermissionsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { permissionsGranted, setPermission, completeStep } = useOnboardingStore();
  const progress = getStepProgress('permissions');
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkExistingPermissions();
  }, []);

  const checkExistingPermissions = async () => {
    try {
      // Check notifications
      const notifStatus = await Notifications.getPermissionsAsync();
      if (notifStatus.granted) {
        setPermission('notifications', true);
      }

      // Check camera
      const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
      if (cameraStatus.granted) {
        setPermission('camera', true);
      }

      // Check microphone
      const audioStatus = await Audio.getPermissionsAsync();
      if (audioStatus.granted) {
        setPermission('microphone', true);
      }

      // Check location
      const locationStatus = await Location.getForegroundPermissionsAsync();
      if (locationStatus.granted) {
        setPermission('location', true);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const requestPermission = async (permission: Permission) => {
    try {
      switch (permission.id) {
        case 'notifications': {
          const { status } = await Notifications.requestPermissionsAsync();
          setPermission('notifications', status === 'granted');
          break;
        }
        case 'camera': {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          setPermission('camera', status === 'granted');
          break;
        }
        case 'microphone': {
          const { status } = await Audio.requestPermissionsAsync();
          setPermission('microphone', status === 'granted');
          break;
        }
        case 'location': {
          const { status } = await Location.requestForegroundPermissionsAsync();
          setPermission('location', status === 'granted');
          break;
        }
      }
    } catch (error) {
      console.error(`Error requesting ${permission.id} permission:`, error);
      Alert.alert(
        'Permission Error',
        `Unable to request ${permission.title} permission. Please enable it in Settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleContinue = () => {
    const requiredPermissions = PERMISSIONS.filter((p) => p.required);
    const missingRequired = requiredPermissions.filter(
      (p) => !permissionsGranted[p.id]
    );

    if (missingRequired.length > 0) {
      Alert.alert(
        'Required Permissions',
        `Please grant ${missingRequired.map((p) => p.title).join(' and ')} permissions to continue. These are needed for core features.`,
        [{ text: 'OK' }]
      );
      return;
    }

    completeStep('permissions');
  };

  const handleSkip = () => {
    const requiredPermissions = PERMISSIONS.filter((p) => p.required);
    const hasRequired = requiredPermissions.every((p) => permissionsGranted[p.id]);

    if (!hasRequired) {
      Alert.alert(
        'Required Permissions',
        'Camera and Microphone permissions are required to use Dryft. Please grant these permissions to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    completeStep('permissions');
  };

  const allRequiredGranted = PERMISSIONS.filter((p) => p.required).every(
    (p) => permissionsGranted[p.id]
  );

  const allGranted = PERMISSIONS.every((p) => permissionsGranted[p.id]);

  const handleAllowAll = async () => {
    for (const permission of PERMISSIONS) {
      if (!permissionsGranted[permission.id]) {
        await requestPermission(permission);
      }
    }
  };

  if (isChecking) {
    return (
      <LinearGradient
        colors={[colors.surface, colors.backgroundSecondary, colors.background]}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.surface, colors.backgroundSecondary, colors.background]}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          disabled={!allRequiredGranted}
        >
          <Text style={[styles.skipText, !allRequiredGranted && styles.skipDisabled]}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enable Permissions</Text>
        <Text style={styles.subtitle}>
          Grant permissions to unlock all features
        </Text>

        <View style={styles.permissionsList}>
          {PERMISSIONS.map((permission) => (
            <View key={permission.id} style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Text style={styles.permissionEmoji}>{permission.icon}</Text>
              </View>
              <View style={styles.permissionInfo}>
                <View style={styles.permissionHeader}>
                  <Text style={styles.permissionTitle}>{permission.title}</Text>
                  {permission.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.permissionDescription}>
                  {permission.description}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.permissionButton,
                  permissionsGranted[permission.id] && styles.permissionGranted,
                ]}
                onPress={() => requestPermission(permission)}
                disabled={permissionsGranted[permission.id]}
              >
                <Text
                  style={[
                    styles.permissionButtonText,
                    permissionsGranted[permission.id] && styles.permissionGrantedText,
                  ]}
                >
                  {permissionsGranted[permission.id] ? '✓' : 'Allow'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {!allGranted && (
          <TouchableOpacity
            style={styles.allowAllButton}
            onPress={handleAllowAll}
          >
            <Text style={styles.allowAllText}>Allow All</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.continueButton, !allRequiredGranted && styles.buttonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={!allRequiredGranted}
        >
          <LinearGradient
            colors={allRequiredGranted ? [colors.primary, colors.primaryDark] : [colors.borderLight, colors.border]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          We only use permissions when needed and never share your data without consent.
        </Text>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: withAlpha(colors.text, '1A'),
    borderRadius: 2,
    marginRight: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  skipDisabled: {
    opacity: 0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  permissionsList: {
    gap: 12,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(colors.text, '0D'),
    borderRadius: 16,
    padding: 16,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.text, '1A'),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionEmoji: {
    fontSize: 24,
  },
  permissionInfo: {
    flex: 1,
    marginRight: 12,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },
  requiredBadge: {
    backgroundColor: withAlpha(colors.primary, '33'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  permissionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: withAlpha(colors.primary, '33'),
    borderWidth: 1,
    borderColor: colors.primary,
  },
  permissionGranted: {
    backgroundColor: withAlpha(colors.success, '33'),
    borderColor: colors.success,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  permissionGrantedText: {
    color: colors.success,
  },
  allowAllButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  allowAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  privacyNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

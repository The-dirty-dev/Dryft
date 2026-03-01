import React, { useState, useEffect } from 'react';
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
        colors={['#1a1a2e', '#16213e', '#0f0f23']}
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
      colors={['#1a1a2e', '#16213e', '#0f0f23']}
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
            colors={allRequiredGranted ? ['#e94560', '#c73e54'] : ['#4a4a5a', '#3a3a4a']}
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

const styles = StyleSheet.create({
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
    color: '#8892b0',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginRight: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: '#8892b0',
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
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892b0',
    marginBottom: 32,
  },
  permissionsList: {
    gap: 12,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#fff',
    marginRight: 8,
  },
  requiredBadge: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    color: '#e94560',
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 13,
    color: '#8892b0',
    lineHeight: 18,
  },
  permissionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  permissionGranted: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderColor: '#2ecc71',
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e94560',
  },
  permissionGrantedText: {
    color: '#2ecc71',
  },
  allowAllButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  allowAllText: {
    fontSize: 14,
    color: '#e94560',
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
    color: '#fff',
  },
  privacyNote: {
    fontSize: 12,
    color: '#8892b0',
    textAlign: 'center',
    lineHeight: 18,
  },
});

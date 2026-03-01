import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import {
  biometricAuth,
  BiometricCapabilities,
} from '../../services/biometricAuth';

interface LockScreenProps {
  onUnlock: () => void;
  onLogout?: () => void;
}

const PIN_LENGTH = 4;

export default function LockScreen({ onUnlock, onLogout }: LockScreenProps) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricCapabilities, setBiometricCapabilities] = useState<BiometricCapabilities | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Initialize
  useEffect(() => {
    initializeAuth();
  }, []);

  // Lockout timer
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const initializeAuth = async () => {
    const capabilities = await biometricAuth.checkCapabilities();
    setBiometricCapabilities(capabilities);

    const bioEnabled = await biometricAuth.isBiometricEnabled();
    setBiometricEnabled(bioEnabled);

    const remaining = await biometricAuth.getRemainingLockoutTime();
    setLockoutTime(remaining);

    const attempts = await biometricAuth.getFailedAttempts();
    setFailedAttempts(attempts);

    // Auto-prompt biometric if available and enabled
    if (capabilities.isAvailable && bioEnabled && remaining === 0) {
      setTimeout(() => authenticateWithBiometrics(), 500);
    }
  };

  const shakeError = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const authenticateWithBiometrics = async () => {
    if (lockoutTime > 0) return;

    setIsLoading(true);
    setError(null);

    const result = await biometricAuth.authenticateWithBiometrics(
      'Unlock Dryft'
    );

    setIsLoading(false);

    if (result.success) {
      onUnlock();
    } else if (result.errorCode === 'LOCKOUT') {
      const remaining = await biometricAuth.getRemainingLockoutTime();
      setLockoutTime(remaining);
      setError(result.error || 'Too many attempts');
    } else if (result.errorCode !== 'user_cancel') {
      setError(result.error || 'Authentication failed');
      const attempts = await biometricAuth.getFailedAttempts();
      setFailedAttempts(attempts);
    }
  };

  const handlePinInput = useCallback(
    async (digit: string) => {
      if (lockoutTime > 0 || pin.length >= PIN_LENGTH) return;

      const newPin = pin + digit;
      setPin(newPin);
      setError(null);

      if (newPin.length === PIN_LENGTH) {
        setIsLoading(true);
        const result = await biometricAuth.authenticateWithPIN(newPin);
        setIsLoading(false);

        if (result.success) {
          onUnlock();
        } else {
          shakeError();
          setPin('');

          if (result.errorCode === 'LOCKOUT') {
            const remaining = await biometricAuth.getRemainingLockoutTime();
            setLockoutTime(remaining);
          }

          setError(result.error || 'Incorrect PIN');
          const attempts = await biometricAuth.getFailedAttempts();
          setFailedAttempts(attempts);
        }
      }
    },
    [pin, lockoutTime, onUnlock]
  );

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  };

  const formatLockoutTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < PIN_LENGTH; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.pinDot,
            {
              backgroundColor:
                i < pin.length ? theme.colors.primary : theme.colors.border,
            },
          ]}
        />
      );
    }
    return dots;
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [
        biometricCapabilities?.isAvailable && biometricEnabled ? 'bio' : '',
        '0',
        'del',
      ],
    ];

    return keys.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.keypadRow}>
        {row.map((key, keyIndex) => {
          if (key === '') {
            return <View key={keyIndex} style={styles.keypadKey} />;
          }

          if (key === 'bio') {
            return (
              <TouchableOpacity
                key={keyIndex}
                style={styles.keypadKey}
                onPress={authenticateWithBiometrics}
                disabled={lockoutTime > 0}
              >
                <Ionicons
                  name={
                    biometricCapabilities?.biometricType === 'facial'
                      ? 'scan'
                      : 'finger-print'
                  }
                  size={28}
                  color={lockoutTime > 0 ? theme.colors.textMuted : theme.colors.primary}
                />
              </TouchableOpacity>
            );
          }

          if (key === 'del') {
            return (
              <TouchableOpacity
                key={keyIndex}
                style={styles.keypadKey}
                onPress={handleDelete}
                onLongPress={() => setPin('')}
              >
                <Ionicons name="backspace-outline" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={keyIndex}
              style={[
                styles.keypadKey,
                { backgroundColor: theme.colors.surface },
              ]}
              onPress={() => handlePinInput(key)}
              disabled={lockoutTime > 0}
            >
              <Text style={[styles.keypadKeyText, { color: theme.colors.text }]}>
                {key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Logo/Header */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.logoText}>D</Text>
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Enter your PIN to unlock
          </Text>
        </View>

        {/* PIN Dots */}
        <Animated.View
          style={[
            styles.pinDotsContainer,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {renderPinDots()}
        </Animated.View>

        {/* Error/Status */}
        <View style={styles.statusContainer}>
          {lockoutTime > 0 ? (
            <View style={[styles.lockoutBanner, { backgroundColor: theme.colors.error + '20' }]}>
              <Ionicons name="lock-closed" size={20} color={theme.colors.error} />
              <Text style={[styles.lockoutText, { color: theme.colors.error }]}>
                Try again in {formatLockoutTime(lockoutTime)}
              </Text>
            </View>
          ) : error ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : failedAttempts > 0 ? (
            <Text style={[styles.attemptsText, { color: theme.colors.warning }]}>
              {5 - failedAttempts} attempts remaining
            </Text>
          ) : null}
        </View>

        {/* Keypad */}
        <View style={styles.keypad}>{renderKeypad()}</View>

        {/* Footer */}
        <View style={styles.footer}>
          {onLogout && (
            <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
              <Text style={[styles.logoutText, { color: theme.colors.textSecondary }]}>
                Log out
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statusContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  attemptsText: {
    fontSize: 14,
  },
  lockoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  lockoutText: {
    fontSize: 14,
    fontWeight: '500',
  },
  keypad: {
    flex: 1,
    justifyContent: 'center',
    maxHeight: 360,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  keypadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  keypadKeyText: {
    fontSize: 28,
    fontWeight: '500',
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  logoutButton: {
    padding: 12,
  },
  logoutText: {
    fontSize: 14,
  },
});

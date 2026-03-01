import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/common';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, isLoading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    await register(email, password, displayName || undefined);
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Dryft</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          {displayError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
              <Button
                title="Dismiss"
                variant="ghost"
                onPress={() => {
                  setLocalError(null);
                  clearError();
                }}
                style={styles.dismissButton}
                textStyle={styles.dismissText}
              />
            </View>
          )}

          <View style={styles.form}>
            <Input
              placeholder="Display Name (optional)"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
            />

            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <Input
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              disabled={isLoading}
            />
          </View>

          <Text style={styles.terms}>
            By creating an account, you agree to our Terms of Service and Privacy
            Policy. You must be 18+ to use this app.
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Button
              title="Sign In"
              variant="ghost"
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
              textStyle={styles.linkText}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e94560',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#8892b0',
    textAlign: 'center',
    marginBottom: 40,
  },
  errorContainer: {
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#e94560',
    flex: 1,
  },
  dismissButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissText: {
    color: '#e94560',
    fontWeight: '600',
  },
  form: {
    gap: 16,
  },
  terms: {
    color: '#8892b0',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  footerText: {
    color: '#8892b0',
    fontSize: 16,
  },
  linkButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  linkText: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: '600',
  },
});

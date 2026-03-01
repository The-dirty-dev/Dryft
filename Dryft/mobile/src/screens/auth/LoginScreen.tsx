import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../../components/common';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) return;
    await login(email, password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Dryft</Text>
        <Text style={styles.subtitle}>Welcome back</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Dismiss"
              variant="ghost"
              onPress={clearError}
              style={styles.dismissButton}
              textStyle={styles.dismissText}
            />
          </View>
        )}

        <View style={styles.form}>
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
            autoComplete="password"
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Button
            title="Sign Up"
            variant="ghost"
            onPress={() => navigation.navigate('Register')}
            style={styles.linkButton}
            textStyle={styles.linkText}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
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

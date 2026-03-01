import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOnboardingStore } from '../../store/onboardingStore';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { completeStep } = useOnboardingStore();

  const handleGetStarted = () => {
    completeStep('welcome');
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f0f23']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>D</Text>
          </View>
          <Text style={styles.appName}>Dryft</Text>
        </View>

        <Text style={styles.tagline}>
          Meet real people in virtual reality
        </Text>

        <View style={styles.featuresPreview}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>🎭</Text>
            </View>
            <Text style={styles.featureText}>Custom Avatars</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>🌐</Text>
            </View>
            <Text style={styles.featureText}>Virtual Worlds</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>💬</Text>
            </View>
            <Text style={styles.featureText}>Voice Chat</Text>
          </View>
        </View>

        <View style={styles.ageNotice}>
          <Text style={styles.ageNoticeText}>
            Dryft is exclusively for adults 18+
          </Text>
          <Text style={styles.ageNoticeSubtext}>
            Age verification required
          </Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#e94560', '#c73e54']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.linkText}>Terms of Service</Text> and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 18,
    color: '#8892b0',
    textAlign: 'center',
    marginBottom: 48,
  },
  featuresPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 48,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureEmoji: {
    fontSize: 28,
  },
  featureText: {
    fontSize: 12,
    color: '#8892b0',
    textAlign: 'center',
  },
  ageNotice: {
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.3)',
    alignItems: 'center',
  },
  ageNoticeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e94560',
    marginBottom: 4,
  },
  ageNoticeSubtext: {
    fontSize: 13,
    color: '#8892b0',
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  getStartedButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
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
  termsText: {
    fontSize: 12,
    color: '#8892b0',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#e94560',
  },
});

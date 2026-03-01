import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOnboardingStore, getStepProgress } from '../../store/onboardingStore';

interface SafetyFeature {
  icon: string;
  title: string;
  description: string;
}

const SAFETY_FEATURES: SafetyFeature[] = [
  {
    icon: '🚨',
    title: 'Panic Button',
    description: 'Instantly exit any situation in VR. Available everywhere, no questions asked.',
  },
  {
    icon: '🛡️',
    title: 'Block Anyone',
    description: 'Block any user at any time. They won\'t be able to contact you or see your profile.',
  },
  {
    icon: '📢',
    title: 'Report & Review',
    description: 'Our moderation team reviews all reports within 24 hours.',
  },
  {
    icon: '✅',
    title: 'Verified Users',
    description: 'All users must verify their age. No fake profiles or bots.',
  },
  {
    icon: '🔒',
    title: 'Private by Default',
    description: 'Your location, real name, and contact info stay private unless you choose to share.',
  },
  {
    icon: '💬',
    title: 'Consent First',
    description: 'Explicit content and haptic connections require mutual consent.',
  },
];

export default function SafetyScreen() {
  const { completeStep } = useOnboardingStore();
  const progress = getStepProgress('safety');

  const handleContinue = () => {
    completeStep('safety');
  };

  const handleSkip = () => {
    completeStep('safety');
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f0f23']}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <View style={styles.shieldIcon}>
            <Text style={styles.shieldEmoji}>🛡️</Text>
          </View>
          <Text style={styles.title}>Your Safety Matters</Text>
          <Text style={styles.subtitle}>
            We've built powerful tools to keep you safe. Here's what you should know.
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          {SAFETY_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={styles.featureIconContainer}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.commitmentCard}>
          <Text style={styles.commitmentTitle}>Our Commitment</Text>
          <Text style={styles.commitmentText}>
            We have zero tolerance for harassment, abuse, or illegal content.
            Violations result in immediate ban and may be reported to authorities.
          </Text>
        </View>

        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            Need help? Contact us anytime at{' '}
            <Text style={styles.helpLink}>safety@dryft.site</Text>
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#e94560', '#c73e54']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>I Understand</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  shieldIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892b0',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresGrid: {
    gap: 16,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#8892b0',
    lineHeight: 20,
  },
  commitmentCard: {
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
    marginBottom: 16,
  },
  commitmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e94560',
    marginBottom: 8,
  },
  commitmentText: {
    fontSize: 14,
    color: '#8892b0',
    lineHeight: 22,
  },
  helpSection: {
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#8892b0',
  },
  helpLink: {
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
});

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOnboardingStore, getStepProgress } from '../../store/onboardingStore';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

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

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

export default function SafetyScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      colors={[colors.surface, colors.backgroundSecondary, colors.background]}
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
            We&apos;ve built powerful tools to keep you safe. Here&apos;s what you should know.
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
            colors={[colors.primary, colors.primaryDark]}
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: withAlpha(colors.success, '26'),
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
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresGrid: {
    gap: 16,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: withAlpha(colors.text, '0D'),
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.text, '1A'),
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
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  commitmentCard: {
    backgroundColor: withAlpha(colors.primary, '1A'),
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, '33'),
    marginBottom: 16,
  },
  commitmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  commitmentText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  helpSection: {
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  helpLink: {
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
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VerificationStackParamList } from '../../navigation';
import apiClient from '../../api/client';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

type NavigationProp = NativeStackNavigationProp<VerificationStackParamList>;

interface VerificationStatus {
  stripe_verified: boolean;
  jumio_verified: boolean;
  face_match_passed: boolean;
  overall_status: 'pending' | 'verified' | 'rejected' | 'manual_review';
  rejection_reason?: string;
}

export default function VerificationStatusScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const response = await apiClient.get<VerificationStatus>('/v1/age-gate/status');

    if (response.success && response.data) {
      setStatus(response.data);
    }

    setIsLoading(false);
  };

  const getStepStatus = (completed: boolean) => {
    return completed ? (
      <View style={styles.stepComplete}>
        <Text style={styles.stepCompleteText}>✓</Text>
      </View>
    ) : (
      <View style={styles.stepIncomplete}>
        <Text style={styles.stepIncompleteText}>○</Text>
      </View>
    );
  };

  const getNextStep = () => {
    if (!status) return 'card';
    if (!status.stripe_verified) return 'card';
    if (!status.jumio_verified) return 'id';
    return null;
  };

  const handleContinue = () => {
    const nextStep = getNextStep();
    if (nextStep === 'card') {
      navigation.navigate('CardVerification');
    } else if (nextStep === 'id') {
      navigation.navigate('IDVerification');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const isVerified = status?.overall_status === 'verified';
  const isRejected = status?.overall_status === 'rejected';
  const isPending = status?.overall_status === 'manual_review';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Age Verification</Text>
          <Text style={styles.subtitle}>
            We need to verify your age before you can access Dryft.
            This is required by law for adult content platforms.
          </Text>
        </View>

        {isVerified ? (
          <View style={styles.verifiedContainer}>
            <View style={styles.verifiedIcon}>
              <Text style={styles.verifiedIconText}>✓</Text>
            </View>
            <Text style={styles.verifiedTitle}>You're Verified!</Text>
            <Text style={styles.verifiedText}>
              Your age has been verified. You now have full access to Dryft.
            </Text>
          </View>
        ) : isRejected ? (
          <View style={styles.rejectedContainer}>
            <View style={styles.rejectedIcon}>
              <Text style={styles.rejectedIconText}>✕</Text>
            </View>
            <Text style={styles.rejectedTitle}>Verification Failed</Text>
            <Text style={styles.rejectedText}>
              {status?.rejection_reason || 'Your verification could not be completed.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleContinue}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : isPending ? (
          <View style={styles.pendingContainer}>
            <ActivityIndicator size="large" color={colors.warning} />
            <Text style={styles.pendingTitle}>Under Review</Text>
            <Text style={styles.pendingText}>
              Your verification is being reviewed. This usually takes less than 24 hours.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.stepsContainer}>
              <View style={styles.step}>
                {getStepStatus(status?.stripe_verified || false)}
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Card Verification</Text>
                  <Text style={styles.stepDescription}>
                    Verify your payment method
                  </Text>
                </View>
              </View>

              <View style={styles.stepConnector} />

              <View style={styles.step}>
                {getStepStatus(status?.jumio_verified || false)}
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>ID Verification</Text>
                  <Text style={styles.stepDescription}>
                    Upload your government ID
                  </Text>
                </View>
              </View>

              <View style={styles.stepConnector} />

              <View style={styles.step}>
                {getStepStatus(status?.face_match_passed || false)}
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Face Match</Text>
                  <Text style={styles.stepDescription}>
                    Take a selfie to confirm identity
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>
                {getNextStep() === 'card' ? 'Start Verification' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your information is encrypted and securely stored.
            We never share your data with third parties.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  stepsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepComplete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCompleteText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepIncomplete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIncompleteText: {
    color: colors.textSecondary,
    fontSize: 20,
  },
  stepContent: {
    marginLeft: 16,
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepConnector: {
    width: 2,
    height: 24,
    backgroundColor: colors.backgroundSecondary,
    marginLeft: 15,
    marginVertical: 8,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  verifiedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  verifiedIconText: {
    color: colors.text,
    fontSize: 40,
  },
  verifiedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  verifiedText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rejectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  rejectedIconText: {
    color: colors.text,
    fontSize: 40,
  },
  rejectedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  rejectedText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.warning,
    marginTop: 24,
    marginBottom: 12,
  },
  pendingText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

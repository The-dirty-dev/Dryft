import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { VerificationStackParamList } from '../../navigation';
import apiClient from '../../api/client';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

type NavigationProp = NativeStackNavigationProp<VerificationStackParamList>;
const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

export default function IDVerificationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);

  const startVerification = async () => {
    setIsLoading(true);

    try {
      const response = await apiClient.post<{ redirect_url: string; scan_ref: string }>(
        '/v1/age-gate/id/initiate'
      );

      if (response.success && response.data) {
        setVerificationStarted(true);
        // Open Jumio verification in browser
        const canOpen = await Linking.canOpenURL(response.data.redirect_url);
        if (canOpen) {
          await Linking.openURL(response.data.redirect_url);
        } else {
          Alert.alert(t('alerts.title.error'), t('alerts.verification.openPageFailed'));
        }
      } else {
        Alert.alert(t('alerts.title.error'), t('alerts.verification.startIdFailed'));
      }
    } catch (err) {
      Alert.alert(t('alerts.title.error'), t('alerts.verification.unexpectedError'));
    }

    setIsLoading(false);
  };

  const checkStatus = async () => {
    setIsLoading(true);

    const response = await apiClient.get<{
      overall_status: string;
      jumio_verified: boolean;
    }>('/v1/age-gate/status');

    if (response.success && response.data) {
      if (response.data.overall_status === 'verified') {
        Alert.alert(t('alerts.title.success'), t('alerts.verification.verifiedMessage'), [
          { text: t('alerts.actions.continue'), onPress: () => navigation.navigate('VerificationStatus') },
        ]);
      } else if (response.data.overall_status === 'manual_review') {
        Alert.alert(
          t('alerts.title.underReview'),
          t('alerts.verification.underReviewMessage'),
          [{ text: t('alerts.actions.ok'), onPress: () => navigation.navigate('VerificationStatus') }]
        );
      } else if (response.data.jumio_verified) {
        Alert.alert(t('alerts.title.almostDone'), t('alerts.verification.idVerifiedMessage'), [
          { text: t('alerts.actions.ok') },
        ]);
      } else {
        Alert.alert(t('alerts.title.pending'), t('alerts.verification.pendingMessage'), [
          { text: t('alerts.actions.ok') },
        ]);
      }
    }

    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>Step 2 of 2</Text>
          </View>
          <Text style={styles.title}>ID Verification</Text>
          <Text style={styles.subtitle}>
            Upload a photo of your government-issued ID and take a selfie
            to verify your identity and age.
          </Text>
        </View>

        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>What you'll need:</Text>

          <View style={styles.requirement}>
            <Text style={styles.requirementIcon}>🪪</Text>
            <View style={styles.requirementContent}>
              <Text style={styles.requirementTitle}>Government ID</Text>
              <Text style={styles.requirementText}>
                Driver's license, passport, or national ID card
              </Text>
            </View>
          </View>

          <View style={styles.requirement}>
            <Text style={styles.requirementIcon}>📸</Text>
            <View style={styles.requirementContent}>
              <Text style={styles.requirementTitle}>Selfie</Text>
              <Text style={styles.requirementText}>
                A clear photo of your face for identity verification
              </Text>
            </View>
          </View>

          <View style={styles.requirement}>
            <Text style={styles.requirementIcon}>💡</Text>
            <View style={styles.requirementContent}>
              <Text style={styles.requirementTitle}>Good Lighting</Text>
              <Text style={styles.requirementText}>
                Make sure you're in a well-lit area for clear photos
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>Your Privacy Matters</Text>
          <Text style={styles.privacyText}>
            • ID verification is processed by Jumio, a trusted provider{'\n'}
            • We only receive your age and verification status{'\n'}
            • Your ID images are encrypted and deleted after verification{'\n'}
            • We never sell or share your personal data
          </Text>
        </View>

        {!verificationStarted ? (
          <TouchableOpacity
            style={[styles.startButton, isLoading && styles.startButtonDisabled]}
            onPress={startVerification}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.startButtonText}>Start ID Verification</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.completedContainer}>
            <Text style={styles.completedText}>
              Complete the verification in the browser window.
              Once done, tap the button below to check your status.
            </Text>

            <TouchableOpacity
              style={[styles.checkButton, isLoading && styles.checkButtonDisabled]}
              onPress={checkStatus}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.checkButtonText}>Check Verification Status</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restartButton}
              onPress={startVerification}
              disabled={isLoading}
            >
              <Text style={styles.restartButtonText}>Restart Verification</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  stepIndicator: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  stepText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
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
  requirementsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  requirement: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  requirementIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  requirementContent: {
    flex: 1,
  },
  requirementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  requirementText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  privacyBox: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: withAlpha(colors.primary, '66'),
  },
  startButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  completedContainer: {
    marginBottom: 16,
  },
  completedText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  checkButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  checkButtonDisabled: {
    backgroundColor: withAlpha(colors.success, '66'),
  },
  checkButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  restartButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  restartButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});

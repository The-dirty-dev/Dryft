import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CardField, useStripe, useConfirmSetupIntent } from '@stripe/stripe-react-native';
import { useTranslation } from 'react-i18next';
import { VerificationStackParamList } from '../../navigation';
import apiClient from '../../api/client';

type NavigationProp = NativeStackNavigationProp<VerificationStackParamList>;

export default function CardVerificationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const { t } = useTranslation();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  useEffect(() => {
    initiateCardVerification();
  }, []);

  const initiateCardVerification = async () => {
    const response = await apiClient.post<{ client_secret: string }>(
      '/v1/age-gate/card/initiate'
    );

    if (response.success && response.data) {
      setClientSecret(response.data.client_secret);
    } else {
      Alert.alert(t('alerts.title.error'), t('alerts.verification.startCardFailed'));
    }

    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!clientSecret || !cardComplete) return;

    setIsSubmitting(true);

    try {
      const { setupIntent, error } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        Alert.alert(
          t('alerts.title.verificationFailed'),
          error.message || t('alerts.verification.unexpectedError')
        );
        setIsSubmitting(false);
        return;
      }

      if (setupIntent?.status === 'Succeeded') {
        // Confirm with our backend
        const confirmResponse = await apiClient.post('/v1/age-gate/card/confirm', {
          setup_intent_id: setupIntent.id,
        });

        if (confirmResponse.success) {
          navigation.navigate('IDVerification');
        } else {
          Alert.alert(t('alerts.title.error'), t('alerts.verification.confirmFailed'));
        }
      }
    } catch (err) {
      Alert.alert(t('alerts.title.error'), t('alerts.verification.unexpectedError'));
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Setting up verification...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>Step 1 of 2</Text>
          </View>
          <Text style={styles.title}>Card Verification</Text>
          <Text style={styles.subtitle}>
            Enter your payment card details. We'll perform a $0 authorization
            to verify the card is valid and belongs to an adult.
          </Text>
        </View>

        <View style={styles.cardContainer}>
          <Text style={styles.cardLabel}>Card Details</Text>
          <CardField
            postalCodeEnabled={true}
            placeholders={{
              number: '4242 4242 4242 4242',
            }}
            cardStyle={{
              backgroundColor: '#1a1a2e',
              textColor: '#ffffff',
              placeholderColor: '#8892b0',
              borderWidth: 1,
              borderColor: '#16213e',
              borderRadius: 12,
            }}
            style={styles.cardField}
            onCardChange={(details) => {
              setCardComplete(details.complete);
            }}
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>🔒</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Secure & Private</Text>
            <Text style={styles.infoText}>
              Your card details are encrypted and processed by Stripe.
              We never store your full card number.
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>💳</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>No Charge</Text>
            <Text style={styles.infoText}>
              We only verify your card is valid. No money will be charged.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!cardComplete || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!cardComplete || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Verify Card</Text>
          )}
        </TouchableOpacity>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8892b0',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    marginBottom: 32,
  },
  stepIndicator: {
    backgroundColor: '#e94560',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  stepText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892b0',
    lineHeight: 24,
  },
  cardContainer: {
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#8892b0',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#e9456066',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: '#8892b0',
    fontSize: 16,
  },
});

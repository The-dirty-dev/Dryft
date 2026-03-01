import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../../navigation';
import apiClient from '../../api/client';
import { Button } from '../../components/common';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Checkout'>;

interface PurchaseDetails {
  purchase_id: string;
  item_name: string;
  item_thumbnail?: string;
  creator_name: string;
  amount: number;
  currency: string;
}

export default function CheckoutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();
  const { itemId, purchaseId, clientSecret } = route.params;
  const { confirmPayment } = useConfirmPayment();

  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  useEffect(() => {
    loadPurchaseDetails();
  }, [purchaseId]);

  const loadPurchaseDetails = async () => {
    const response = await apiClient.get<{ purchase: PurchaseDetails }>(
      `/v1/store/purchases/${purchaseId}`
    );

    if (response.success && response.data) {
      setPurchaseDetails(response.data.purchase);
    }

    setIsLoading(false);
  };

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const handlePayment = async () => {
    if (!clientSecret || !cardComplete) return;

    setIsProcessing(true);

    try {
      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        Alert.alert(
          t('alerts.title.paymentFailed'),
          error.message || t('alerts.checkout.unexpectedError')
        );
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'Succeeded') {
        navigation.replace('CheckoutSuccess', { purchaseId });
      }
    } catch (err) {
      Alert.alert(t('alerts.title.error'), t('alerts.checkout.unexpectedError'));
    }

    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Order Summary */}
        {purchaseDetails && (
          <View style={styles.orderSummary}>
            <Text style={styles.sectionTitle}>Order Summary</Text>

            <View style={styles.itemRow}>
              {purchaseDetails.item_thumbnail && (
                <Image
                  source={{ uri: purchaseDetails.item_thumbnail }}
                  style={styles.thumbnail}
                />
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{purchaseDetails.item_name}</Text>
                <Text style={styles.creatorName}>by {purchaseDetails.creator_name}</Text>
              </View>
            </View>

            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Total</Text>
              <Text style={styles.pricingValue}>
                {formatPrice(purchaseDetails.amount, purchaseDetails.currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Payment Details */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Details</Text>

          <View style={styles.cardContainer}>
            <CardField
              postalCodeEnabled={true}
              placeholders={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={{
                backgroundColor: colors.surface,
                textColor: colors.text,
                placeholderColor: colors.textSecondary,
                borderWidth: 1,
                borderColor: colors.backgroundSecondary,
                borderRadius: 12,
              }}
              style={styles.cardField}
              onCardChange={(details) => {
                setCardComplete(details.complete);
              }}
            />
          </View>
        </View>

        {/* Security Info */}
        <View style={styles.securityInfo}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Your payment is secure and encrypted by Stripe
          </Text>
        </View>

        {/* Pay Button */}
        <Button
          title={`Pay ${purchaseDetails ? formatPrice(purchaseDetails.amount, purchaseDetails.currency) : ''}`}
          onPress={handlePayment}
          disabled={!cardComplete || isProcessing}
          loading={isProcessing}
          style={[
            styles.payButton,
            (!cardComplete || isProcessing) && styles.payButtonDisabled,
          ]}
          textStyle={styles.payButtonText}
        />

        {/* Cancel */}
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          disabled={isProcessing}
          style={styles.cancelButton}
          textStyle={styles.cancelButtonText}
          variant="secondary"
        />
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
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderSummary: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  creatorName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  pricingLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  pricingValue: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
  },
  paymentSection: {
    marginBottom: 20,
  },
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  securityIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  securityText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  payButtonDisabled: {
    backgroundColor: withAlpha(colors.primary, '66'),
  },
  payButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});

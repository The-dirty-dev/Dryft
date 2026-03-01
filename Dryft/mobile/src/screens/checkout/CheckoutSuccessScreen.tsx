import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import apiClient from '../../api/client';
import { Button } from '../../components/common';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'CheckoutSuccess'>;

interface PurchaseDetails {
  purchase_id: string;
  item_id: string;
  item_name: string;
  item_thumbnail?: string;
  item_type: string;
  creator_name: string;
  amount: number;
  currency: string;
  status: string;
}

export default function CheckoutSuccessScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const route = useRoute<RouteProps>();
  const { purchaseId } = route.params;

  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    pollPurchaseStatus();
  }, [purchaseId]);

  const pollPurchaseStatus = async () => {
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      const response = await apiClient.get<{ purchase: PurchaseDetails }>(
        `/v1/store/purchases/${purchaseId}`
      );

      if (response.success && response.data) {
        const purchaseData = response.data.purchase;

        if (purchaseData.status === 'completed' || attempts >= maxAttempts) {
          setPurchase(purchaseData);
          setIsLoading(false);
          return;
        }

        attempts++;
        setTimeout(poll, 1000);
      } else {
        setIsLoading(false);
      }
    };

    poll();
  };

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const goToInventory = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
    // Navigate to inventory tab after reset
  };

  const continueShopping = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Confirming your purchase...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>

        <Text style={styles.title}>Purchase Complete!</Text>
        <Text style={styles.subtitle}>
          Thank you for your purchase. Your item is now in your inventory.
        </Text>

        {/* Purchase Details */}
        {purchase && (
          <View style={styles.purchaseCard}>
            <View style={styles.itemRow}>
              {purchase.item_thumbnail ? (
                <Image
                  source={{ uri: purchase.item_thumbnail }}
                  style={styles.thumbnail}
                />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Text style={styles.thumbnailPlaceholderText}>📦</Text>
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{purchase.item_name}</Text>
                <Text style={styles.creatorName}>by {purchase.creator_name}</Text>
                <View style={styles.typeTag}>
                  <Text style={styles.typeTagText}>{purchase.item_type}</Text>
                </View>
              </View>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Order ID</Text>
              <Text style={styles.receiptValue}>
                {purchase.purchase_id.slice(0, 8).toUpperCase()}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Amount Paid</Text>
              <Text style={styles.receiptAmount}>
                {purchase.amount === 0
                  ? 'Free'
                  : formatPrice(purchase.amount, purchase.currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="View in Inventory"
            onPress={goToInventory}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />

          <Button
            title="Continue Shopping"
            onPress={continueShopping}
            style={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
            variant="secondary"
          />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    color: colors.text,
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  purchaseCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 28,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 16,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  creatorName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  typeTag: {
    backgroundColor: withAlpha(colors.primary, '33'),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  typeTagText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  receiptValue: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'monospace',
  },
  receiptAmount: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import {
  useSubscriptionStore,
  SubscriptionTier,
  PRODUCT_IDS,
  TIER_ENTITLEMENTS,
} from '../../store/subscriptionStore';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

interface PlanCardProps {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyMonthlyPrice: string;
  savings?: string;
  features: string[];
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  selectedBilling: 'monthly' | 'yearly';
  onSelect: () => void;
}

function PlanCard({
  tier,
  name,
  monthlyPrice,
  yearlyPrice,
  yearlyMonthlyPrice,
  savings,
  features,
  isPopular,
  isCurrentPlan,
  selectedBilling,
  onSelect,
}: PlanCardProps) {
  const theme = useTheme();

  const price = selectedBilling === 'monthly' ? monthlyPrice : yearlyMonthlyPrice;
  const billingText = selectedBilling === 'monthly' ? '/month' : '/month, billed yearly';

  const gradientColors = {
    plus: [theme.colors.info, theme.colors.primaryDark],
    premium: [theme.colors.accent, theme.colors.accentSecondary],
    vip: [theme.colors.warning, theme.colors.primaryDark],
  };

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={isCurrentPlan}
      style={[
        styles.planCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isPopular ? theme.colors.primary : theme.colors.border,
          borderWidth: isPopular ? 2 : 1,
        },
      ]}
    >
      {isPopular && (
        <View style={[styles.popularBadge, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.popularText, { color: theme.colors.text }]}>MOST POPULAR</Text>
        </View>
      )}

      {isCurrentPlan && (
        <View style={[styles.currentBadge, { backgroundColor: theme.colors.success }]}>
          <Text style={[styles.currentText, { color: theme.colors.text }]}>CURRENT PLAN</Text>
        </View>
      )}

      <LinearGradient
        colors={gradientColors[tier as keyof typeof gradientColors] || [theme.colors.textMuted, theme.colors.textSecondary]}
        style={styles.planHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={[styles.planName, { color: theme.colors.text }]}>{name}</Text>
        {tier === 'vip' && <Ionicons name="diamond" size={20} color={theme.colors.text} />}
      </LinearGradient>

      <View style={styles.planContent}>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: theme.colors.text }]}>{price}</Text>
          <Text style={[styles.billingText, { color: theme.colors.textSecondary }]}>
            {billingText}
          </Text>
        </View>

        {savings && selectedBilling === 'yearly' && (
          <View style={[styles.savingsBadge, { backgroundColor: theme.colors.success + '20' }]}>
            <Text style={[styles.savingsText, { color: theme.colors.success }]}>
              Save {savings}
            </Text>
          </View>
        )}

        <View style={styles.featuresList}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
              <Text style={[styles.featureText, { color: theme.colors.text }]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {!isCurrentPlan && (
          <TouchableOpacity
            onPress={onSelect}
            style={[styles.selectButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.selectButtonText, { color: theme.colors.text }]}>
              {selectedBilling === 'yearly' ? `Get ${name} - ${yearlyPrice}/year` : `Get ${name}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function SubscriptionScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    products,
    subscription,
    isLoading,
    error,
    initialize,
    purchaseProduct,
    restorePurchases,
    clearError,
  } = useSubscriptionStore();

  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('yearly');
  const featureToHighlight = route.params?.feature;

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  const handlePurchase = async (tier: SubscriptionTier) => {
    const productId = selectedBilling === 'monthly'
      ? PRODUCT_IDS[`${tier.toUpperCase()}_MONTHLY` as keyof typeof PRODUCT_IDS]
      : PRODUCT_IDS[`${tier.toUpperCase()}_YEARLY` as keyof typeof PRODUCT_IDS];

    if (productId) {
      await purchaseProduct(productId);
    }
  };

  const getProductPrice = (productId: string): string => {
    const product = products.find(p => p.productId === productId);
    return product?.price || '$--';
  };

  const currentTier = subscription?.tier || 'free';

  const PLANS = [
    {
      tier: 'plus' as SubscriptionTier,
      name: 'Dryft+',
      monthlyPrice: getProductPrice(PRODUCT_IDS.PLUS_MONTHLY),
      yearlyPrice: getProductPrice(PRODUCT_IDS.PLUS_YEARLY),
      yearlyMonthlyPrice: '$9.99',
      savings: '33%',
      features: [
        'Unlimited likes',
        '5 Super Likes per day',
        'Rewind last swipe',
        'See who likes you',
        'Advanced filters',
        'Read receipts',
        '1 free Boost per month',
      ],
    },
    {
      tier: 'premium' as SubscriptionTier,
      name: 'Premium',
      monthlyPrice: getProductPrice(PRODUCT_IDS.PREMIUM_MONTHLY),
      yearlyPrice: getProductPrice(PRODUCT_IDS.PREMIUM_YEARLY),
      yearlyMonthlyPrice: '$19.99',
      savings: '40%',
      isPopular: true,
      features: [
        'Everything in Dryft+',
        'Unlimited Super Likes',
        'Private VR rooms',
        'Custom avatars',
        'Premium VR environments',
        'Priority matching',
        'Incognito mode',
        '3 free Boosts per month',
      ],
    },
    {
      tier: 'vip' as SubscriptionTier,
      name: 'VIP',
      monthlyPrice: getProductPrice(PRODUCT_IDS.VIP_MONTHLY),
      yearlyPrice: getProductPrice(PRODUCT_IDS.VIP_YEARLY),
      yearlyMonthlyPrice: '$29.99',
      savings: '50%',
      features: [
        'Everything in Premium',
        '5 free Boosts per month',
        'Priority customer support',
        'Exclusive VIP badge',
        'Early access to features',
        'VIP-only events',
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Upgrade Your Experience
        </Text>
        <TouchableOpacity onPress={restorePurchases}>
          <Text style={[styles.restoreText, { color: theme.colors.primary }]}>
            Restore
          </Text>
        </TouchableOpacity>
      </View>

      {featureToHighlight && (
        <View style={[styles.featureHighlight, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name="lock-closed" size={20} color={theme.colors.primary} />
          <Text style={[styles.featureHighlightText, { color: theme.colors.primary }]}>
            Unlock {featureToHighlight} with a premium subscription
          </Text>
        </View>
      )}

      {/* Billing Toggle */}
      <View style={styles.billingToggle}>
        <TouchableOpacity
          onPress={() => setSelectedBilling('monthly')}
          style={[
            styles.billingOption,
            { backgroundColor: withAlpha(theme.colors.text, '1A') },
            selectedBilling === 'monthly' && {
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.billingOptionText,
              { color: selectedBilling === 'monthly' ? theme.colors.text : theme.colors.text },
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedBilling('yearly')}
          style={[
            styles.billingOption,
            { backgroundColor: withAlpha(theme.colors.text, '1A') },
            selectedBilling === 'yearly' && {
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.billingOptionText,
              { color: selectedBilling === 'yearly' ? theme.colors.text : theme.colors.text },
            ]}
          >
            Yearly
          </Text>
          <View style={[styles.saveBadge, { backgroundColor: theme.colors.success }]}>
            <Text style={[styles.saveBadgeText, { color: theme.colors.text }]}>SAVE UP TO 50%</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          PLANS.map((plan) => (
            <PlanCard
              key={plan.tier}
              {...plan}
              isCurrentPlan={currentTier === plan.tier}
              selectedBilling={selectedBilling}
              onSelect={() => handlePurchase(plan.tier)}
            />
          ))
        )}

        {/* Free tier comparison */}
        <View style={[styles.freeComparison, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.freeTitle, { color: theme.colors.text }]}>
            Free Plan Includes
          </Text>
          <View style={styles.freeFeatures}>
            <Text style={[styles.freeFeature, { color: theme.colors.textSecondary }]}>
              • 50 likes per day
            </Text>
            <Text style={[styles.freeFeature, { color: theme.colors.textSecondary }]}>
              • 1 Super Like per day
            </Text>
            <Text style={[styles.freeFeature, { color: theme.colors.textSecondary }]}>
              • Basic VR access
            </Text>
            <Text style={[styles.freeFeature, { color: theme.colors.textSecondary }]}>
              • Standard matching
            </Text>
          </View>
        </View>

        {/* Terms */}
        <Text style={[styles.terms, { color: theme.colors.textMuted }]}>
          Subscriptions automatically renew unless cancelled at least 24 hours before the end of
          the current period. You can manage your subscription in your device settings.
        </Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
  featureHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  featureHighlightText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  billingToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  billingOption: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  billingOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loader: {
    marginTop: 40,
  },
  planCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
  },
  currentBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  currentText: {
    fontSize: 10,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
  },
  planContent: {
    padding: 16,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
  },
  billingText: {
    fontSize: 14,
  },
  savingsBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featuresList: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  selectButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  freeComparison: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  freeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  freeFeatures: {
    gap: 4,
  },
  freeFeature: {
    fontSize: 14,
  },
  terms: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  bottomPadding: {
    height: 40,
  },
});

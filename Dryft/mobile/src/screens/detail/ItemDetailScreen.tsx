import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { StoreItem, formatPrice } from '../../types';
import marketplaceApi from '../../api/marketplace';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export default function ItemDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [item, setItem] = useState<StoreItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const { purchaseItem } = useMarketplaceStore();

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    setIsLoading(true);
    const response = await marketplaceApi.getItem(itemId);
    if (response.success && response.data) {
      setItem(response.data);
    }
    setIsLoading(false);
  };

  const handlePurchase = async () => {
    if (!item) return;

    setIsPurchasing(true);
    const result = await purchaseItem(item.id);
    setIsPurchasing(false);

    if (result.success) {
      if (result.clientSecret) {
        // Paid item - would integrate with Stripe here
        Alert.alert(
          'Payment Required',
          'This item requires payment. Complete the purchase using the payment link sent to your email.'
        );
      } else {
        // Free item - acquired
        Alert.alert('Success!', `${item.name} has been added to your inventory!`);
        setItem({ ...item, is_owned: true });
      }
    } else {
      Alert.alert('Error', 'Failed to purchase item. Please try again.');
    }
  };

  const handleCreatorPress = () => {
    if (item?.creator_id) {
      navigation.navigate('Creator', { creatorId: item.creator_id });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Item not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.image}
          contentFit="cover"
        />

        <View style={styles.details}>
          <View style={styles.header}>
            <View style={styles.badges}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.item_type}</Text>
              </View>
              {item.is_featured && (
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>Featured</Text>
                </View>
              )}
            </View>

            <Text style={styles.name}>{item.name}</Text>

            <TouchableOpacity onPress={handleCreatorPress}>
              <Text style={styles.creator}>by {item.creator_name}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {item.rating_count > 0 ? item.rating.toFixed(1) : '-'}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{item.rating_count}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{item.purchase_count}</Text>
              <Text style={styles.statLabel}>Purchases</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>

          {item.tags && item.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tags}>
                {item.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text
            style={[styles.priceValue, item.price === 0 && styles.priceFree]}
          >
            {formatPrice(item.price, item.currency)}
          </Text>
        </View>

        {item.is_owned ? (
          <View style={styles.ownedButton}>
            <Text style={styles.ownedButtonText}>Owned</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.buyButton, isPurchasing && styles.buyButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing}
          >
            {isPurchasing ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buyButtonText}>
                {item.price === 0 ? 'Get Free' : 'Buy Now'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
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
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: colors.surface,
  },
  details: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeBadge: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  featuredBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  creator: {
    fontSize: 16,
    color: colors.primary,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  description: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  priceFree: {
    color: colors.success,
  },
  buyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buyButtonDisabled: {
    opacity: 0.7,
  },
  buyButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  ownedButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  ownedButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { StoreItem, formatPrice } from '../types';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

interface ItemCardProps {
  item: StoreItem;
  onPress: () => void;
  compact?: boolean;
}

export default function ItemCard({ item, onPress, compact = false }: ItemCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.thumbnail_url }}
          style={[styles.image, compact && styles.imageCompact]}
          contentFit="cover"
          placeholder={require('../../assets/placeholder.png')}
        />
        {item.is_featured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}
        {item.is_owned && (
          <View style={styles.ownedBadge}>
            <Text style={styles.ownedText}>Owned</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.creator} numberOfLines={1}>
          by {item.creator_name}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.price, item.price === 0 && styles.priceFree]}>
            {formatPrice(item.price, item.currency)}
          </Text>
          {item.rating_count > 0 && (
            <Text style={styles.rating}>
              {item.rating.toFixed(1)} ({item.rating_count})
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  cardCompact: {
    width: '100%',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: colors.backgroundSecondary,
  },
  imageCompact: {
    height: 100,
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  featuredText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  ownedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ownedText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  creator: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  priceFree: {
    color: colors.success,
  },
  rating: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

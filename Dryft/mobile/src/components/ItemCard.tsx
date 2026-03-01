import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { StoreItem, formatPrice } from '../types';

interface ItemCardProps {
  item: StoreItem;
  onPress: () => void;
  compact?: boolean;
}

export default function ItemCard({ item, onPress, compact = false }: ItemCardProps) {
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

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#16213e',
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
    backgroundColor: '#16213e',
  },
  imageCompact: {
    height: 100,
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e94560',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  featuredText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  ownedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ownedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  creator: {
    fontSize: 12,
    color: '#8892b0',
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
    color: '#e94560',
  },
  priceFree: {
    color: '#10b981',
  },
  rating: {
    fontSize: 12,
    color: '#8892b0',
  },
});

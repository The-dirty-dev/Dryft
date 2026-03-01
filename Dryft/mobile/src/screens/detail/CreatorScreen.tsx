import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { Creator, StoreItem } from '../../types';
import marketplaceApi from '../../api/marketplace';
import ItemCard from '../../components/ItemCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Creator'>;

export default function CreatorScreen({ route, navigation }: Props) {
  const { creatorId } = route.params;
  const [creator, setCreator] = useState<Creator | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCreator();
  }, [creatorId]);

  const loadCreator = async () => {
    setIsLoading(true);

    const [creatorRes, itemsRes] = await Promise.all([
      marketplaceApi.getCreator(creatorId),
      marketplaceApi.getCreatorItems(creatorId),
    ]);

    if (creatorRes.success && creatorRes.data) {
      setCreator(creatorRes.data);
      navigation.setOptions({
        title: creatorRes.data.store_name || creatorRes.data.display_name || 'Creator',
      });
    }

    if (itemsRes.success && itemsRes.data) {
      setItems(itemsRes.data.items || []);
    }

    setIsLoading(false);
  };

  const handleItemPress = (item: StoreItem) => {
    navigation.navigate('ItemDetail', { itemId: item.id });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Creator not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <ItemCard
              item={item}
              onPress={() => handleItemPress(item)}
              compact
            />
          </View>
        )}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            {/* Banner */}
            {creator.banner_url ? (
              <Image
                source={{ uri: creator.banner_url }}
                style={styles.banner}
                contentFit="cover"
              />
            ) : (
              <View style={styles.bannerPlaceholder} />
            )}

            {/* Profile */}
            <View style={styles.profile}>
              {creator.avatar_url ? (
                <Image
                  source={{ uri: creator.avatar_url }}
                  style={styles.logo}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoText}>
                    {(creator.store_name || creator.display_name || 'C')
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.storeName}>
                    {creator.store_name || creator.display_name}
                  </Text>
                  {creator.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>

                {creator.bio && (
                  <Text style={styles.description}>{creator.bio}</Text>
                )}
              </View>
            </View>

            {/* Stats */}
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{creator.item_count}</Text>
                <Text style={styles.statLabel}>Items</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{creator.total_sales}</Text>
                <Text style={styles.statLabel}>Sales</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {creator.average_rating > 0 ? creator.average_rating.toFixed(1) : '-'}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>

            <Text style={styles.itemsTitle}>Items</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items yet</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  errorText: {
    color: '#8892b0',
    fontSize: 16,
  },
  list: {
    paddingBottom: 20,
  },
  header: {
    marginBottom: 16,
  },
  banner: {
    width: '100%',
    height: 150,
    backgroundColor: '#1a1a2e',
  },
  bannerPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#1a1a2e',
  },
  profile: {
    flexDirection: 'row',
    padding: 20,
    marginTop: -40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#0f0f23',
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#0f0f23',
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#8892b0',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#16213e',
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  itemWrapper: {
    flex: 1,
    padding: 4,
    paddingHorizontal: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8892b0',
    fontSize: 16,
  },
});

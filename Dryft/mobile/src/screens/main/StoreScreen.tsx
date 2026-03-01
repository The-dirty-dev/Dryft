import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import ItemCard from '../../components/ItemCard';
import { ItemType, StoreItem } from '../../types';
import { Button, Input } from '../../components/common';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ITEM_TYPES: { label: string; value: ItemType | null }[] = [
  { label: 'All', value: null },
  { label: 'Avatars', value: 'avatar' },
  { label: 'Outfits', value: 'outfit' },
  { label: 'Toys', value: 'toy' },
  { label: 'Effects', value: 'effect' },
  { label: 'Gestures', value: 'gesture' },
];

export default function StoreScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ItemType | null>(null);

  const {
    items,
    totalItems,
    currentPage,
    isLoadingStore,
    loadItems,
    searchItems,
    setFilter,
  } = useMarketplaceStore();

  useEffect(() => {
    loadItems();
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchItems(searchQuery.trim());
    } else {
      loadItems();
    }
  };

  const handleTypeSelect = (type: ItemType | null) => {
    setSelectedType(type);
    if (type) {
      setFilter({ type });
    } else {
      setFilter({});
    }
  };

  const handleItemPress = (item: StoreItem) => {
    navigation.navigate('ItemDetail', { itemId: item.id });
  };

  const handleLoadMore = () => {
    const hasMore = (currentPage + 1) * 20 < totalItems;
    if (hasMore && !isLoadingStore) {
      loadItems(undefined, currentPage + 1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Store</Text>

        <View style={styles.searchContainer}>
          <Input
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor="#8892b0"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <Button
            title="Search"
            onPress={handleSearch}
            style={styles.searchButton}
            textStyle={styles.searchButtonText}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeFilter}
          contentContainerStyle={styles.typeFilterContent}
        >
          {ITEM_TYPES.map((type) => (
            <TouchableOpacity
              key={type.label}
              style={[
                styles.typeChip,
                selectedType === type.value && styles.typeChipActive,
              ]}
              onPress={() => handleTypeSelect(type.value)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  selectedType === type.value && styles.typeChipTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoadingStore && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
        </View>
      ) : (
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
          contentContainerStyle={styles.grid}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingStore ? (
              <ActivityIndicator
                style={styles.loadingMore}
                color="#e94560"
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0f0f23',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#16213e',
  },
  searchButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  typeFilter: {
    marginTop: 16,
    marginHorizontal: -20,
  },
  typeFilterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#16213e',
  },
  typeChipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  typeChipText: {
    color: '#8892b0',
    fontSize: 14,
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8892b0',
    marginTop: 8,
  },
  grid: {
    padding: 12,
  },
  itemWrapper: {
    flex: 1,
    padding: 4,
  },
  loadingMore: {
    padding: 20,
  },
});

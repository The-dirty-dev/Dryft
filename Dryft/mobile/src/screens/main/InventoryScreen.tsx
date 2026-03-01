import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { ItemType, InventoryItem, formatPrice } from '../../types';
import { Image } from 'expo-image';

const ITEM_TYPES: { label: string; value: ItemType | null }[] = [
  { label: 'All', value: null },
  { label: 'Avatars', value: 'avatar' },
  { label: 'Outfits', value: 'outfit' },
  { label: 'Toys', value: 'toy' },
  { label: 'Effects', value: 'effect' },
  { label: 'Gestures', value: 'gesture' },
];

export default function InventoryScreen() {
  const [selectedType, setSelectedType] = useState<ItemType | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    inventory,
    equippedItems,
    isLoadingInventory,
    loadInventory,
    loadEquippedItems,
    equipItem,
    unequipItem,
  } = useMarketplaceStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadInventory(), loadEquippedItems()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTypeSelect = (type: ItemType | null) => {
    setSelectedType(type);
    loadInventory(type || undefined);
  };

  const handleEquipToggle = async (item: InventoryItem) => {
    if (item.is_equipped) {
      await unequipItem(item.item_id);
    } else {
      await equipItem(item.item_id);
    }
  };

  const filteredInventory = selectedType
    ? inventory.filter((item) => item.item?.item_type === selectedType)
    : inventory;

  const renderInventoryItem = ({ item }: { item: InventoryItem }) => (
    <View style={styles.inventoryCard}>
      <Image
        source={{ uri: item.item?.thumbnail_url }}
        style={styles.itemImage}
        contentFit="cover"
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.item?.name}
        </Text>
        <Text style={styles.itemType}>{item.item?.item_type}</Text>
      </View>
      <TouchableOpacity
        style={[
          styles.equipButton,
          item.is_equipped && styles.equipButtonActive,
        ]}
        onPress={() => handleEquipToggle(item)}
      >
        <Text
          style={[
            styles.equipButtonText,
            item.is_equipped && styles.equipButtonTextActive,
          ]}
        >
          {item.is_equipped ? 'Unequip' : 'Equip'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>

        {/* Equipped Items Summary */}
        <View style={styles.equippedSection}>
          <Text style={styles.sectionLabel}>Currently Equipped</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.equippedScroll}
          >
            {Object.entries(equippedItems).map(([type, item]) => (
              <View key={type} style={styles.equippedSlot}>
                {item ? (
                  <Image
                    source={{ uri: item.item?.thumbnail_url }}
                    style={styles.equippedImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.equippedEmpty}>
                    <Text style={styles.equippedEmptyText}>
                      {type.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.equippedLabel}>{type}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Type Filter */}
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

      {isLoadingInventory && inventory.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : filteredInventory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items yet</Text>
          <Text style={styles.emptySubtext}>
            Visit the store to get some items!
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item.id}
          renderItem={renderInventoryItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e94560"
            />
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
  equippedSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#8892b0',
    marginBottom: 8,
  },
  equippedScroll: {
    marginHorizontal: -20,
  },
  equippedSlot: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 60,
  },
  equippedImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#e94560',
  },
  equippedEmpty: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  equippedEmptyText: {
    color: '#8892b0',
    fontSize: 16,
    fontWeight: '600',
  },
  equippedLabel: {
    color: '#8892b0',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  typeFilter: {
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
  list: {
    padding: 16,
  },
  inventoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#16213e',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#16213e',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  itemType: {
    fontSize: 13,
    color: '#8892b0',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  equipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  equipButtonActive: {
    backgroundColor: '#e94560',
  },
  equipButtonText: {
    color: '#e94560',
    fontWeight: '600',
    fontSize: 13,
  },
  equipButtonTextActive: {
    color: '#fff',
  },
});

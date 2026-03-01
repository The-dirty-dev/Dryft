import React, { useEffect, useMemo, useState } from 'react';
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
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const ITEM_TYPES: { label: string; value: ItemType | null }[] = [
  { label: 'All', value: null },
  { label: 'Avatars', value: 'avatar' },
  { label: 'Outfits', value: 'outfit' },
  { label: 'Toys', value: 'toy' },
  { label: 'Effects', value: 'effect' },
  { label: 'Gestures', value: 'gesture' },
];

export default function InventoryScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <ActivityIndicator size="large" color={colors.primary} />
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
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  equippedSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
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
    borderColor: colors.primary,
  },
  equippedEmpty: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equippedEmptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  equippedLabel: {
    color: colors.textSecondary,
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: colors.text,
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
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  list: {
    padding: 16,
  },
  inventoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  itemType: {
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  equipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  equipButtonActive: {
    backgroundColor: colors.primary,
  },
  equipButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  equipButtonTextActive: {
    color: colors.text,
  },
});

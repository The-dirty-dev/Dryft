import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { useAuthStore } from '../../store/authStore';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import ItemCard from '../../components/ItemCard';
import { StoreItem } from '../../types';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const {
    featuredItems,
    popularItems,
    loadFeaturedItems,
    loadPopularItems,
    isLoadingStore,
  } = useMarketplaceStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadFeaturedItems(), loadPopularItems()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleItemPress = (item: StoreItem) => {
    navigation.navigate('ItemDetail', { itemId: item.id });
  };

  const renderSection = (title: string, items: StoreItem[], onSeeAll?: () => void) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ItemCard item={item} onPress={() => handleItemPress(item)} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.itemList}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hey, {user?.display_name || 'there'}!
          </Text>
          <Text style={styles.subGreeting}>What would you like today?</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {renderSection('Featured', featuredItems, () => {
          // Navigate to store with featured filter
        })}

        {renderSection('Popular', popularItems, () => {
          // Navigate to store with popular sort
        })}

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Store' } as any)}
            >
              <Text style={styles.actionTitle}>Browse Store</Text>
              <Text style={styles.actionSubtitle}>Find new items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' } as any)}
            >
              <Text style={styles.actionTitle}>My Inventory</Text>
              <Text style={styles.actionSubtitle}>Manage items</Text>
            </TouchableOpacity>
          </View>

          {/* VR Companion Card */}
          <TouchableOpacity
            style={styles.companionCard}
            onPress={() => navigation.navigate('Companion' as any)}
          >
            <Text style={styles.companionIcon}>🥽</Text>
            <View style={styles.companionInfo}>
              <Text style={styles.companionTitle}>Join VR Session</Text>
              <Text style={styles.companionSubtitle}>
                Connect to a VR user with a session code
              </Text>
            </View>
            <Text style={styles.companionArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subGreeting: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  itemList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  quickActions: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bottomPadding: {
    height: 100,
  },
  companionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  companionIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  companionInfo: {
    flex: 1,
  },
  companionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  companionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  companionArrow: {
    fontSize: 20,
    color: colors.primary,
  },
});

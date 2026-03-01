import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useActivities, useDailyActivity } from '../hooks/useCouples';
import type { Activity } from '../services/couples';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'COMMUNICATION', label: 'Talk', icon: '💬' },
  { id: 'GAMES', label: 'Games', icon: '🎮' },
  { id: 'CREATIVE', label: 'Creative', icon: '🎨' },
  { id: 'WELLNESS', label: 'Wellness', icon: '🧘' },
  { id: 'ROMANCE', label: 'Romance', icon: '💕' },
  { id: 'ADVENTURE', label: 'Adventure', icon: '🌟' },
];

export default function ActivitiesScreen() {
  const navigation = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { activity: dailyActivity, refresh: refreshDaily } = useDailyActivity();
  const { activities, loading, refresh } = useActivities(
    selectedCategory === 'all' ? undefined : { category: selectedCategory }
  );

  const handleRefresh = () => {
    refresh();
    refreshDaily();
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={[styles.activityCard, item.is_completed && styles.completedCard]}
      onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
    >
      <View style={styles.activityHeader}>
        <Text style={styles.activityIcon}>{item.icon_url || '⭐'}</Text>
        {item.is_daily && (
          <View style={styles.dailyBadge}>
            <Text style={styles.dailyBadgeText}>Daily</Text>
          </View>
        )}
        {item.is_premium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
        )}
        {item.is_completed && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>Done</Text>
          </View>
        )}
      </View>

      <Text style={styles.activityTitle}>{item.title}</Text>
      <Text style={styles.activityDesc} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.activityMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>⏱️</Text>
          <Text style={styles.metaText}>{item.duration} min</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>⭐</Text>
          <Text style={styles.metaText}>+{item.xp_reward} XP</Text>
        </View>
        <View style={[styles.difficultyBadge, styles[`difficulty${item.difficulty}`]]}>
          <Text style={styles.difficultyText}>{item.difficulty}</Text>
        </View>
      </View>

      {item.requires_both && (
        <View style={styles.requiresBoth}>
          <Text style={styles.requiresBothText}>👥 Both partners needed</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activities</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Daily Activity Banner */}
      {dailyActivity && !dailyActivity.is_completed && (
        <TouchableOpacity
          style={styles.dailyBanner}
          onPress={() =>
            navigation.navigate('ActivityDetail', { activityId: dailyActivity.id })
          }
        >
          <View style={styles.dailyBannerContent}>
            <Text style={styles.dailyBannerIcon}>{dailyActivity.icon_url || '☀️'}</Text>
            <View style={styles.dailyBannerText}>
              <Text style={styles.dailyBannerTitle}>Today's Activity</Text>
              <Text style={styles.dailyBannerName}>{dailyActivity.title}</Text>
            </View>
            <View style={styles.dailyBannerXp}>
              <Text style={styles.dailyBannerXpText}>+{dailyActivity.xp_reward}</Text>
              <Text style={styles.dailyBannerXpLabel}>XP</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categories}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === cat.id && styles.categoryLabelActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Activities List */}
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor="#fff" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No activities found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    color: '#fff',
    fontSize: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  dailyBanner: {
    backgroundColor: '#4C1D95',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dailyBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  dailyBannerIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  dailyBannerText: {
    flex: 1,
  },
  dailyBannerTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  dailyBannerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dailyBannerXp: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dailyBannerXpText: {
    color: '#FCD34D',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dailyBannerXpLabel: {
    color: '#FCD34D',
    fontSize: 10,
  },
  categories: {
    maxHeight: 50,
    marginBottom: 8,
  },
  categoriesContent: {
    paddingHorizontal: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  categoryChipActive: {
    backgroundColor: '#6B46C1',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  categoryLabelActive: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
  },
  activityCard: {
    backgroundColor: '#1F1F2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '48%',
  },
  completedCard: {
    opacity: 0.6,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityIcon: {
    fontSize: 28,
    marginRight: 8,
  },
  dailyBadge: {
    backgroundColor: '#FCD34D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  dailyBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  premiumBadge: {
    backgroundColor: '#EC4899',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  premiumBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  completedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  completedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activityTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activityDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  difficultyEASY: {
    backgroundColor: '#D1FAE5',
  },
  difficultyMEDIUM: {
    backgroundColor: '#FEF3C7',
  },
  difficultyHARD: {
    backgroundColor: '#FEE2E2',
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  requiresBoth: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2D2D3D',
  },
  requiresBothText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
});

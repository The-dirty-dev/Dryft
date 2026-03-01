import React, { useMemo, useState } from 'react';
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
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.text} />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    color: colors.text,
    fontSize: 24,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  dailyBanner: {
    backgroundColor: withAlpha(colors.accentSecondary, '80'),
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
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  dailyBannerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  dailyBannerXp: {
    alignItems: 'center',
    backgroundColor: withAlpha(colors.text, '33'),
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dailyBannerXpText: {
    color: colors.accentYellow,
    fontSize: 18,
    fontWeight: 'bold',
  },
  dailyBannerXpLabel: {
    color: colors.accentYellow,
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
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  categoryChipActive: {
    backgroundColor: colors.accentSecondary,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryLabel: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  categoryLabelActive: {
    color: colors.text,
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
  },
  activityCard: {
    backgroundColor: colors.surfaceSecondary,
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
    backgroundColor: colors.accentYellow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  dailyBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: 'bold',
  },
  premiumBadge: {
    backgroundColor: colors.accentPink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  premiumBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  completedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  completedBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  activityTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activityDesc: {
    color: colors.textTertiary,
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
    color: colors.textTertiary,
    fontSize: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  difficultyEASY: {
    backgroundColor: withAlpha(colors.success, '33'),
  },
  difficultyMEDIUM: {
    backgroundColor: withAlpha(colors.warning, '33'),
  },
  difficultyHARD: {
    backgroundColor: withAlpha(colors.error, '33'),
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textInverse,
    textTransform: 'capitalize',
  },
  requiresBoth: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requiresBothText: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 16,
  },
});

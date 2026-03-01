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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAchievements, useLeaderboard } from '../hooks/useCouples';
import type { Achievement } from '../services/couples';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

const getRarityColors = (colors: ThemeColors): Record<string, { bg: string; text: string; border: string }> => ({
  COMMON: { bg: colors.border, text: colors.textTertiary, border: colors.borderLight },
  UNCOMMON: { bg: withAlpha(colors.success, '33'), text: colors.like, border: colors.success },
  RARE: { bg: withAlpha(colors.info, '33'), text: colors.superLike, border: colors.info },
  EPIC: { bg: withAlpha(colors.accent, '33'), text: colors.accent, border: colors.accent },
  LEGENDARY: { bg: withAlpha(colors.warning, '33'), text: colors.accentYellow, border: colors.warning },
});

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🏆' },
  { id: 'STREAK', name: 'Streaks', icon: '🔥' },
  { id: 'ACTIVITY', name: 'Activities', icon: '⭐' },
  { id: 'QUIZ', name: 'Quizzes', icon: '🧠' },
  { id: 'MILESTONE', name: 'Milestones', icon: '🎯' },
];

export default function AchievementsScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rarityColors = useMemo(() => getRarityColors(colors), [colors]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const { achievements, earned, totalXp, loading, refresh } = useAchievements(
    selectedCategory === 'all' ? undefined : selectedCategory
  );
  const { leaderboard, userRank } = useLeaderboard('xp');

  const earnedCount = earned.length;
  const totalCount = achievements.length;
  const progress = totalCount > 0 ? earnedCount / totalCount : 0;

  const renderAchievement = ({ item }: { item: Achievement }) => {
    const rarityStyle = rarityColors[item.rarity] || rarityColors.COMMON;

    return (
      <View
        style={[
          styles.achievementCard,
          { borderColor: item.is_earned ? rarityStyle.border : colors.border },
          !item.is_earned && styles.lockedCard,
        ]}
      >
        <View style={styles.achievementIcon}>
          <Text style={[styles.iconText, !item.is_earned && styles.lockedIcon]}>
            {item.icon_url || '🏆'}
          </Text>
        </View>

        <View style={styles.achievementContent}>
          <View style={styles.achievementHeader}>
            <Text style={[styles.achievementName, !item.is_earned && styles.lockedText]}>
              {item.name}
            </Text>
            <View style={[styles.rarityBadge, { backgroundColor: rarityStyle.bg }]}>
              <Text style={[styles.rarityText, { color: rarityStyle.text }]}>
                {item.rarity}
              </Text>
            </View>
          </View>

          <Text style={[styles.achievementDesc, !item.is_earned && styles.lockedText]}>
            {item.description}
          </Text>

          <View style={styles.achievementMeta}>
            <Text style={styles.xpReward}>+{item.xp_reward} XP</Text>
            {item.is_earned && item.earned_at && (
              <Text style={styles.earnedDate}>
                Earned {new Date(item.earned_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        {item.is_earned && (
          <View style={styles.checkmark}>
            <Text>✓</Text>
          </View>
        )}
      </View>
    );
  };

  const renderLeaderboardItem = ({ item, index }: { item: any; index: number }) => (
    <View
      style={[
        styles.leaderboardItem,
        item.is_current_user && styles.currentUserItem,
      ]}
    >
      <View style={styles.rankContainer}>
        {index < 3 ? (
          <Text style={styles.rankEmoji}>
            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
          </Text>
        ) : (
          <Text style={styles.rankNumber}>#{item.rank}</Text>
        )}
      </View>

      <View style={styles.coupleInfo}>
        <Text style={styles.coupleName}>{item.nickname}</Text>
        <Text style={styles.coupleStats}>
          Level {item.level} • 🔥 {item.streak}
        </Text>
      </View>

      <View style={styles.xpContainer}>
        <Text style={styles.xpValue}>{item.xp.toLocaleString()}</Text>
        <Text style={styles.xpLabel}>XP</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <TouchableOpacity onPress={() => setShowLeaderboard(!showLeaderboard)}>
          <Text style={styles.leaderboardToggle}>
            {showLeaderboard ? '🏆' : '📊'}
          </Text>
        </TouchableOpacity>
      </View>

      {showLeaderboard ? (
        <>
          {/* Leaderboard View */}
          <View style={styles.leaderboardHeader}>
            <Text style={styles.leaderboardTitle}>Leaderboard</Text>
            {userRank && (
              <Text style={styles.yourRank}>Your Rank: #{userRank}</Text>
            )}
          </View>

          <FlatList
            data={leaderboard}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item) => item.couple_id}
            contentContainerStyle={styles.listContent}
          />
        </>
      ) : (
        <>
          {/* Progress Header */}
          <LinearGradient colors={[colors.accentSecondary, colors.accentPink]} style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressTitle}>Your Progress</Text>
                <Text style={styles.progressCount}>
                  {earnedCount} / {totalCount} Achievements
                </Text>
              </View>
              <View style={styles.totalXp}>
                <Text style={styles.totalXpValue}>{totalXp.toLocaleString()}</Text>
                <Text style={styles.totalXpLabel}>Total XP</Text>
              </View>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </LinearGradient>

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
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Achievements List */}
          <FlatList
            data={achievements}
            renderItem={renderAchievement}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.text} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No achievements found</Text>
              </View>
            }
          />
        </>
      )}
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
  leaderboardToggle: {
    fontSize: 24,
  },
  progressCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 14,
  },
  progressCount: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalXp: {
    alignItems: 'flex-end',
  },
  totalXpValue: {
    color: colors.accentYellow,
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalXpLabel: {
    color: colors.text,
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: withAlpha(colors.text, '4D'),
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.text,
    borderRadius: 4,
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
    padding: 16,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  lockedCard: {
    opacity: 0.5,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  lockedIcon: {
    opacity: 0.5,
  },
  achievementContent: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  achievementName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  lockedText: {
    color: colors.textMuted,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  achievementDesc: {
    color: colors.textTertiary,
    fontSize: 13,
    marginBottom: 8,
  },
  achievementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpReward: {
    color: colors.accentYellow,
    fontSize: 13,
    fontWeight: '600',
  },
  earnedDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: 12,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leaderboardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  yourRank: {
    color: colors.accentPink,
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
  },
  currentUserItem: {
    backgroundColor: withAlpha(colors.accentSecondary, '80'),
    borderWidth: 2,
    borderColor: colors.accentSecondary,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 24,
  },
  rankNumber: {
    color: colors.textTertiary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  coupleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  coupleName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  coupleStats: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  xpContainer: {
    alignItems: 'flex-end',
  },
  xpValue: {
    color: colors.accentYellow,
    fontSize: 18,
    fontWeight: 'bold',
  },
  xpLabel: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 16,
  },
});

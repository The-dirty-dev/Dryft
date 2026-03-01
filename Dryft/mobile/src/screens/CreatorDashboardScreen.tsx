import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useCreatorProfile,
  useEngagementStats,
  useAudienceInsights,
  useCreatorEarnings,
  useCreatorGoals,
  useTierProgress,
  useLeaderboard,
} from '../hooks/useCreatorDashboard';
import { TimePeriod } from '../services/creatorDashboard';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

interface CreatorDashboardScreenProps {
  onNavigateToEarnings?: () => void;
  onNavigateToInsights?: () => void;
  onNavigateToGoals?: () => void;
  onNavigateToLeaderboard?: () => void;
}

export const CreatorDashboardScreen: React.FC<CreatorDashboardScreenProps> = ({
  onNavigateToEarnings,
  onNavigateToInsights,
  onNavigateToGoals,
  onNavigateToLeaderboard,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { profile, fetchProfile, tierColor, tierIcon } = useCreatorProfile();
  const { stats, refresh: refreshStats, formatChange, formatNumber } = useEngagementStats(selectedPeriod);
  const { insights } = useAudienceInsights();
  const { earnings, formatEarnings } = useCreatorEarnings(selectedPeriod);
  const { goals, activeGoals, getGoalProgress } = useCreatorGoals();
  const { progress, nextTier, currentTier } = useTierProgress();
  const { entries: leaderboardEntries, myRank } = useLeaderboard('engagement', selectedPeriod);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchProfile(), refreshStats()]);
    setIsRefreshing(false);
  }, [fetchProfile, refreshStats]);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all_time', label: 'All Time' },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* Header with Tier */}
      <LinearGradient
        colors={[tierColor, tierColor + 'CC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.tierBadge}>
            <Ionicons name={tierIcon as any} size={24} color={colors.text} />
            <Text style={styles.tierText}>{currentTier.toUpperCase()}</Text>
          </View>
          <Text style={styles.headerTitle}>Creator Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {profile?.followerCount ? formatNumber(profile.followerCount) : 0} followers
          </Text>
        </View>

        {/* Tier Progress */}
        {progress && nextTier && (
          <View style={styles.tierProgressContainer}>
            <View style={styles.tierProgressHeader}>
              <Text style={styles.tierProgressLabel}>
                Progress to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}
              </Text>
              <Text style={styles.tierProgressValue}>
                {formatNumber(progress.current)} / {formatNumber(progress.required)}
              </Text>
            </View>
            <View style={styles.tierProgressBar}>
              <View
                style={[
                  styles.tierProgressFill,
                  { width: `${progress.percentage}%` },
                ]}
              />
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Period Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodSelector}
        contentContainerStyle={styles.periodSelectorContent}
      >
        {periods.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.key)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.key && styles.periodButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Engagement Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="eye"
            label="Profile Views"
            value={stats?.profileViews || 0}
            change={stats?.profileViewsChange || 0}
            formatNumber={formatNumber}
            formatChange={formatChange}
          />
          <StatCard
            icon="heart"
            label="Likes"
            value={stats?.likes || 0}
            change={stats?.likesChange || 0}
            formatNumber={formatNumber}
            formatChange={formatChange}
          />
          <StatCard
            icon="people"
            label="Matches"
            value={stats?.matches || 0}
            change={stats?.matchesChange || 0}
            formatNumber={formatNumber}
            formatChange={formatChange}
          />
          <StatCard
            icon="chatbubble"
            label="Messages"
            value={stats?.messages || 0}
            change={stats?.messagesChange || 0}
            formatNumber={formatNumber}
            formatChange={formatChange}
          />
        </View>
      </View>

      {/* Earnings Summary */}
      <TouchableOpacity
        style={styles.section}
        onPress={onNavigateToEarnings}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.earningsCard}>
          <View style={styles.earningsMain}>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsValue}>
              {formatEarnings(earnings?.total || 0)}
            </Text>
          </View>
          <View style={styles.earningsBreakdown}>
            <View style={styles.earningsItem}>
              <Ionicons name="gift" size={16} color={colors.accentPink} />
              <Text style={styles.earningsItemLabel}>Gifts</Text>
              <Text style={styles.earningsItemValue}>
                {formatEarnings(earnings?.gifts || 0)}
              </Text>
            </View>
            <View style={styles.earningsItem}>
              <Ionicons name="card" size={16} color={colors.accent} />
              <Text style={styles.earningsItemLabel}>Subs</Text>
              <Text style={styles.earningsItemValue}>
                {formatEarnings(earnings?.subscriptions || 0)}
              </Text>
            </View>
            <View style={styles.earningsItem}>
              <Ionicons name="cash" size={16} color={colors.success} />
              <Text style={styles.earningsItemLabel}>Tips</Text>
              <Text style={styles.earningsItemValue}>
                {formatEarnings(earnings?.tips || 0)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Active Goals */}
      <TouchableOpacity
        style={styles.section}
        onPress={onNavigateToGoals}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Goals</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
        {activeGoals.length > 0 ? (
          activeGoals.slice(0, 2).map((goal) => (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Ionicons
                  name={
                    goal.type === 'followers'
                      ? 'people'
                      : goal.type === 'earnings'
                      ? 'cash'
                      : goal.type === 'matches'
                      ? 'heart'
                      : 'trending-up'
                  }
                  size={20}
                  color={colors.accent}
                />
                <Text style={styles.goalType}>
                  {goal.type.charAt(0).toUpperCase() + goal.type.slice(1)}
                </Text>
                <Text style={styles.goalTarget}>
                  {formatNumber(goal.current)} / {formatNumber(goal.target)}
                </Text>
              </View>
              <View style={styles.goalProgressBar}>
                <View
                  style={[
                    styles.goalProgressFill,
                    { width: `${getGoalProgress(goal)}%` },
                  ]}
                />
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyGoals}>
            <Text style={styles.emptyGoalsText}>No active goals</Text>
            <TouchableOpacity style={styles.addGoalButton} onPress={onNavigateToGoals}>
              <Text style={styles.addGoalButtonText}>Set a Goal</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* Audience Insights Preview */}
      <TouchableOpacity
        style={styles.section}
        onPress={onNavigateToInsights}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Audience Insights</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.insightsPreview}>
          {insights?.ageDistribution?.slice(0, 3).map((item, index) => (
            <View key={index} style={styles.insightItem}>
              <Text style={styles.insightLabel}>{item.range}</Text>
              <View style={styles.insightBarContainer}>
                <View
                  style={[
                    styles.insightBar,
                    { width: `${item.percentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.insightValue}>{item.percentage.toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      {/* Leaderboard Preview */}
      <TouchableOpacity
        style={styles.section}
        onPress={onNavigateToLeaderboard}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.leaderboardPreview}>
          {leaderboardEntries.slice(0, 3).map((entry, index) => (
            <View key={entry.userId} style={styles.leaderboardItem}>
              <View style={styles.leaderboardRank}>
                {index === 0 ? (
                  <Ionicons name="trophy" size={20} color={colors.warning} />
                ) : (
                  <Text style={styles.leaderboardRankText}>{entry.rank}</Text>
                )}
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardName}>{entry.userName}</Text>
                <Text style={styles.leaderboardScore}>
                  {formatNumber(entry.score)} pts
                </Text>
              </View>
              {entry.change !== 0 && (
                <View
                  style={[
                    styles.leaderboardChange,
                    { backgroundColor: entry.change > 0 ? withAlpha(colors.success, '33') : withAlpha(colors.error, '33') },
                  ]}
                >
                  <Ionicons
                    name={entry.change > 0 ? 'arrow-up' : 'arrow-down'}
                    size={12}
                    color={entry.change > 0 ? colors.success : colors.error}
                  />
                  <Text
                    style={[
                      styles.leaderboardChangeText,
                      { color: entry.change > 0 ? colors.success : colors.error },
                    ]}
                  >
                    {Math.abs(entry.change)}
                  </Text>
                </View>
              )}
            </View>
          ))}
          {myRank && myRank.rank > 3 && (
            <View style={[styles.leaderboardItem, styles.myRankItem]}>
              <View style={styles.leaderboardRank}>
                <Text style={styles.leaderboardRankText}>{myRank.rank}</Text>
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardName}>You</Text>
                <Text style={styles.leaderboardScore}>
                  {formatNumber(myRank.score)} pts
                </Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  change: number;
  formatNumber: (n: number) => string;
  formatChange: (n: number) => { text: string; isPositive: boolean };
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  change,
  formatNumber,
  formatChange,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const changeInfo = formatChange(change);

  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color={colors.accent} />
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <View
        style={[
          styles.statChange,
          { backgroundColor: changeInfo.isPositive ? withAlpha(colors.success, '33') : withAlpha(colors.error, '33') },
        ]}
      >
        <Ionicons
          name={changeInfo.isPositive ? 'arrow-up' : 'arrow-down'}
          size={10}
          color={changeInfo.isPositive ? colors.success : colors.error}
        />
        <Text
          style={[
            styles.statChangeText,
            { color: changeInfo.isPositive ? colors.success : colors.error },
          ]}
        >
          {changeInfo.text}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

function createStyles(colors: ThemeColors) {
  const text80 = withAlpha(colors.text, 'CC');
  const text20 = withAlpha(colors.text, '33');
  const text10 = withAlpha(colors.text, '1A');

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDarkest,
    },
    headerGradient: {
      paddingTop: 60,
      paddingBottom: 24,
      paddingHorizontal: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    header: {
      alignItems: 'center',
    },
    tierBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: text20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 12,
    },
    tierText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: text80,
      fontSize: 14,
      marginTop: 4,
    },
    tierProgressContainer: {
      marginTop: 20,
      backgroundColor: text10,
      borderRadius: 12,
      padding: 12,
    },
    tierProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    tierProgressLabel: {
      color: text80,
      fontSize: 12,
    },
    tierProgressValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    tierProgressBar: {
      height: 4,
      backgroundColor: text20,
      borderRadius: 2,
    },
    tierProgressFill: {
      height: '100%',
      backgroundColor: colors.text,
      borderRadius: 2,
    },
    periodSelector: {
      marginTop: 16,
    },
    periodSelectorContent: {
      paddingHorizontal: 16,
    },
    periodButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      backgroundColor: colors.surface,
    },
    periodButtonActive: {
      backgroundColor: colors.accent,
    },
    periodButtonText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
    periodButtonTextActive: {
      color: colors.text,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
    },
    statCard: {
      width: (SCREEN_WIDTH - 44) / 2,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      margin: 6,
      alignItems: 'center',
    },
    statValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
      marginTop: 8,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    statChange: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 8,
    },
    statChangeText: {
      fontSize: 11,
      fontWeight: '600',
      marginLeft: 2,
    },
    earningsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    earningsMain: {
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    earningsLabel: {
      color: colors.textMuted,
      fontSize: 14,
    },
    earningsValue: {
      color: colors.success,
      fontSize: 32,
      fontWeight: '700',
      marginTop: 4,
    },
    earningsBreakdown: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    earningsItem: {
      alignItems: 'center',
    },
    earningsItemLabel: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 4,
    },
    earningsItemValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginTop: 2,
    },
    goalCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    goalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    goalType: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
      flex: 1,
    },
    goalTarget: {
      color: colors.textMuted,
      fontSize: 12,
    },
    goalProgressBar: {
      height: 6,
      backgroundColor: colors.borderLight,
      borderRadius: 3,
    },
    goalProgressFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 3,
    },
    emptyGoals: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
    },
    emptyGoalsText: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 12,
    },
    addGoalButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    addGoalButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    insightsPreview: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    insightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    insightLabel: {
      color: colors.text,
      fontSize: 12,
      width: 50,
    },
    insightBarContainer: {
      flex: 1,
      height: 8,
      backgroundColor: colors.borderLight,
      borderRadius: 4,
      marginHorizontal: 12,
    },
    insightBar: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 4,
    },
    insightValue: {
      color: colors.textMuted,
      fontSize: 12,
      width: 40,
      textAlign: 'right',
    },
    leaderboardPreview: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
    },
    leaderboardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    myRankItem: {
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      marginTop: 8,
      paddingTop: 16,
    },
    leaderboardRank: {
      width: 32,
      alignItems: 'center',
    },
    leaderboardRankText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    leaderboardInfo: {
      flex: 1,
      marginLeft: 12,
    },
    leaderboardName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    leaderboardScore: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    leaderboardChange: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    leaderboardChangeText: {
      fontSize: 11,
      fontWeight: '600',
      marginLeft: 2,
    },
    bottomPadding: {
      height: 40,
    },
  });
}

export default CreatorDashboardScreen;

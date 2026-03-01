import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useDailyRewards, useRewardsLeaderboard } from '../hooks/useRewards';
import * as Haptics from 'expo-haptics';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const { width } = Dimensions.get('window');
const STREAK_DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function DailyRewardsScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    status,
    loading,
    claiming,
    claimResult,
    error,
    refresh,
    claimReward,
    dismissClaimResult,
  } = useDailyRewards();

  const { leaderboard, userRank, userStats } = useRewardsLeaderboard('streak');

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  // Glow animation for claim button
  useEffect(() => {
    if (!status?.claimed_today) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [status?.claimed_today, glowAnim]);

  const handleClaim = async () => {
    if (claiming || status?.claimed_today) return;

    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();

    await claimReward();

    // Confetti animation
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingEmoji}>🎁</Text>
          <Text style={styles.loadingText}>Loading rewards...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const streakDay = status?.streak.current || 0;
  const nextStreakDay = status?.streak.is_active ? streakDay + 1 : 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Rewards</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Streak Hero */}
        <LinearGradient
          colors={[colors.accentSecondary, colors.accentPink]}
          style={styles.streakHero}
        >
          <View style={styles.streakContainer}>
            <Text style={styles.streakLabel}>Current Streak</Text>
            <View style={styles.streakValueRow}>
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={styles.streakValue}>{streakDay}</Text>
              <Text style={styles.streakDays}>days</Text>
            </View>
            {status?.streak.is_active ? (
              <Text style={styles.streakStatus}>Keep it going!</Text>
            ) : (
              <Text style={styles.streakStatusWarning}>Start a new streak today!</Text>
            )}
          </View>
        </LinearGradient>

        {/* Weekly Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Progress</Text>
          <View style={styles.weekContainer}>
            {STREAK_DAYS.map((day) => {
              const isCompleted = day <= (streakDay % 7 || (streakDay > 0 ? 7 : 0));
              const isCurrent = day === nextStreakDay % 7 || (nextStreakDay % 7 === 0 && day === 7);

              return (
                <View
                  key={day}
                  style={[
                    styles.dayCircle,
                    isCompleted && styles.dayCompleted,
                    isCurrent && !status?.claimed_today && styles.dayCurrent,
                  ]}
                >
                  {isCompleted ? (
                    <Text style={styles.dayCheckmark}>✓</Text>
                  ) : (
                    <Text style={styles.dayNumber}>{day}</Text>
                  )}
                  {day === 7 && (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusBadgeText}>2x</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Today's Reward */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Reward</Text>

          {status?.claimed_today ? (
            <View style={styles.claimedCard}>
              <Text style={styles.claimedEmoji}>✨</Text>
              <Text style={styles.claimedTitle}>Claimed!</Text>
              <Text style={styles.claimedText}>
                Come back tomorrow to continue your streak
              </Text>
            </View>
          ) : (
            <Animated.View
              style={[
                styles.rewardCard,
                {
                  transform: [{ scale: scaleAnim }],
                  shadowOpacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 0.5],
                  }),
                },
              ]}
            >
              <LinearGradient
                colors={[colors.primaryDark, colors.primary]}
                style={styles.rewardGradient}
              >
                <View style={styles.rewardContent}>
                  <Text style={styles.rewardIcon}>🎁</Text>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardTitle}>Day {nextStreakDay} Reward</Text>
                    <View style={styles.rewardDetails}>
                      <Text style={styles.rewardXp}>
                        +{status?.today_reward?.xp || 10} XP
                      </Text>
                      {(status?.today_reward?.streak_bonus || 0) > 0 && (
                        <Text style={styles.rewardBonus}>
                          (+{status?.today_reward?.streak_bonus} streak bonus!)
                        </Text>
                      )}
                    </View>
                    {(status?.today_reward?.coins || 0) > 0 && (
                      <Text style={styles.rewardCoins}>
                        +{status?.today_reward?.coins} coins
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={handleClaim}
                  disabled={claiming}
                  activeOpacity={0.8}
                >
                  <Text style={styles.claimButtonText}>
                    {claiming ? 'Claiming...' : 'Claim Reward'}
                  </Text>
                </TouchableOpacity>

                {status?.today_reward?.milestone_reward && (
                  <View style={styles.milestonePreview}>
                    <Text style={styles.milestoneEmoji}>🏆</Text>
                    <Text style={styles.milestoneText}>
                      {status.today_reward.milestone_reward.title} unlocked!
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        {/* Next Milestone */}
        {status?.next_milestone && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Milestone</Text>
            <View style={styles.milestoneCard}>
              <View style={styles.milestoneInfo}>
                <Text style={styles.milestoneTitle}>{status.next_milestone.title}</Text>
                <Text style={styles.milestoneDays}>
                  {status.next_milestone.days_away} day{status.next_milestone.days_away !== 1 ? 's' : ''} away
                </Text>
              </View>
              <View style={styles.milestoneReward}>
                <Text style={styles.milestoneXp}>+{status.next_milestone.xp_reward}</Text>
                <Text style={styles.milestoneXpLabel}>XP</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        ((status.next_milestone.days - status.next_milestone.days_away) /
                          status.next_milestone.days) *
                          100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {status.next_milestone.days - status.next_milestone.days_away} / {status.next_milestone.days} days
              </Text>
            </View>
          </View>
        )}

        {/* Leaderboard Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Streak Leaderboard</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {leaderboard.slice(0, 5).map((entry, index) => (
            <View
              key={entry.couple_id}
              style={[
                styles.leaderboardRow,
                entry.is_current_user && styles.leaderboardRowHighlight,
              ]}
            >
              <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
              <View style={styles.leaderboardPartners}>
                {entry.partners.slice(0, 2).map((p, i) => (
                  <View
                    key={p.id}
                    style={[styles.leaderboardAvatar, i === 1 && styles.leaderboardAvatarOverlap]}
                  >
                    {p.profile_photo ? (
                      <Image source={{ uri: p.profile_photo }} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>{p.display_name?.charAt(0) || '?'}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardStreak}>🔥 {entry.current_streak} days</Text>
                <Text style={styles.leaderboardLevel}>Level {entry.level}</Text>
              </View>
            </View>
          ))}

          {userRank && userRank > 5 && (
            <View style={[styles.leaderboardRow, styles.leaderboardRowHighlight]}>
              <Text style={styles.leaderboardRank}>#{userRank}</Text>
              <Text style={styles.leaderboardYou}>Your Position</Text>
              <Text style={styles.leaderboardStreak}>
                🔥 {userStats?.current_streak || 0} days
              </Text>
            </View>
          )}
        </View>

        {/* History */}
        {status?.history && status.history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Rewards</Text>
            {status.history.slice(0, 5).map((item, index) => (
              <View key={index} style={styles.historyRow}>
                <Text style={styles.historyDay}>Day {item.streak_day}</Text>
                <Text style={styles.historyDate}>
                  {new Date(item.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.historyXp}>+{item.xp_earned} XP</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Claim Result Modal */}
      {claimResult && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>
              {claimResult.reward.milestone_reached ? '🏆' : '🎉'}
            </Text>
            <Text style={styles.modalTitle}>
              {claimResult.reward.milestone_reached
                ? claimResult.reward.milestone_reached.title
                : 'Reward Claimed!'}
            </Text>
            <Text style={styles.modalXp}>+{claimResult.reward.xp_earned} XP</Text>
            {claimResult.reward.coins_earned > 0 && (
              <Text style={styles.modalCoins}>+{claimResult.reward.coins_earned} coins</Text>
            )}
            <Text style={styles.modalStreak}>
              Day {claimResult.reward.streak_day} complete! 🔥
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={dismissClaimResult}>
              <Text style={styles.modalButtonText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

function createStyles(colors: ThemeColors) {
  const text80 = withAlpha(colors.text, 'CC');
  const text70 = withAlpha(colors.text, 'B3');
  const text10 = withAlpha(colors.text, '1A');

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDarkest,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingEmoji: {
      fontSize: 48,
      marginBottom: 16,
    },
    loadingText: {
      color: colors.textTertiary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      fontSize: 28,
      color: colors.text,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    streakHero: {
      margin: 16,
      borderRadius: 20,
      padding: 24,
    },
    streakContainer: {
      alignItems: 'center',
    },
    streakLabel: {
      color: text80,
      fontSize: 14,
      marginBottom: 8,
    },
    streakValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    fireEmoji: {
      fontSize: 40,
      marginRight: 8,
    },
    streakValue: {
      fontSize: 72,
      fontWeight: 'bold',
      color: colors.text,
    },
    streakDays: {
      fontSize: 24,
      color: text80,
      marginLeft: 8,
      marginBottom: 8,
    },
    streakStatus: {
      color: colors.success,
      fontSize: 16,
      fontWeight: '500',
      marginTop: 8,
    },
    streakStatusWarning: {
      color: colors.warning,
      fontSize: 16,
      fontWeight: '500',
      marginTop: 8,
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 24,
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
      fontWeight: 'bold',
      marginBottom: 12,
    },
    seeAll: {
      color: colors.accentPink,
      fontSize: 14,
    },
    weekContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 16,
      padding: 16,
    },
    dayCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    dayCompleted: {
      backgroundColor: colors.success,
    },
    dayCurrent: {
      backgroundColor: colors.accentSecondary,
      borderWidth: 2,
      borderColor: colors.accentPink,
    },
    dayNumber: {
      color: colors.textTertiary,
      fontWeight: '600',
    },
    dayCheckmark: {
      color: colors.text,
      fontWeight: 'bold',
    },
    bonusBadge: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: colors.accentYellow,
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    bonusBadgeText: {
      color: colors.textInverse,
      fontSize: 10,
      fontWeight: 'bold',
    },
    claimedCard: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
    },
    claimedEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    claimedTitle: {
      color: colors.success,
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    claimedText: {
      color: colors.textTertiary,
      fontSize: 14,
      textAlign: 'center',
    },
    rewardCard: {
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.accentSecondary,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 16,
      elevation: 8,
    },
    rewardGradient: {
      padding: 20,
    },
    rewardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    rewardIcon: {
      fontSize: 48,
      marginRight: 16,
    },
    rewardInfo: {
      flex: 1,
    },
    rewardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    rewardDetails: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rewardXp: {
      color: colors.accentYellow,
      fontSize: 20,
      fontWeight: 'bold',
    },
    rewardBonus: {
      color: colors.success,
      fontSize: 12,
      marginLeft: 8,
    },
    rewardCoins: {
      color: colors.warning,
      fontSize: 14,
      marginTop: 4,
    },
    claimButton: {
      backgroundColor: colors.text,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    claimButtonText: {
      color: colors.accentSecondary,
      fontSize: 18,
      fontWeight: 'bold',
    },
    milestonePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      backgroundColor: text10,
      borderRadius: 8,
      padding: 8,
    },
    milestoneEmoji: {
      fontSize: 16,
      marginRight: 6,
    },
    milestoneText: {
      color: colors.text,
      fontSize: 12,
    },
    milestoneCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    milestoneInfo: {
      flex: 1,
    },
    milestoneTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    milestoneDays: {
      color: colors.textTertiary,
      fontSize: 14,
    },
    milestoneReward: {
      alignItems: 'center',
      backgroundColor: withAlpha(colors.accentSecondary, '33'),
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
    },
    milestoneXp: {
      color: colors.accentYellow,
      fontSize: 20,
      fontWeight: 'bold',
    },
    milestoneXpLabel: {
      color: colors.accentYellow,
      fontSize: 10,
    },
    progressContainer: {
      marginTop: 8,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.borderLight,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accentSecondary,
      borderRadius: 4,
    },
    progressText: {
      color: colors.textTertiary,
      fontSize: 12,
      textAlign: 'right',
      marginTop: 4,
    },
    leaderboardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    leaderboardRowHighlight: {
      backgroundColor: colors.primaryDark,
    },
    leaderboardRank: {
      color: colors.accentYellow,
      fontSize: 16,
      fontWeight: 'bold',
      width: 40,
    },
    leaderboardPartners: {
      flexDirection: 'row',
      marginRight: 12,
    },
    leaderboardAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.surfaceSecondary,
    },
    leaderboardAvatarOverlap: {
      marginLeft: -12,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    avatarPlaceholder: {
      backgroundColor: colors.accentSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: 'bold',
    },
    leaderboardInfo: {
      flex: 1,
    },
    leaderboardStreak: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    leaderboardLevel: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    leaderboardYou: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    historyDay: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    historyDate: {
      color: colors.textTertiary,
      fontSize: 12,
      flex: 1,
      textAlign: 'center',
    },
    historyXp: {
      color: colors.success,
      fontSize: 14,
      fontWeight: '600',
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    modalContent: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      width: '100%',
      maxWidth: 300,
    },
    modalEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    modalXp: {
      color: colors.accentYellow,
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    modalCoins: {
      color: colors.warning,
      fontSize: 16,
      marginBottom: 8,
    },
    modalStreak: {
      color: colors.textTertiary,
      fontSize: 14,
      marginBottom: 24,
    },
    modalButton: {
      backgroundColor: colors.accentSecondary,
      paddingHorizontal: 48,
      paddingVertical: 16,
      borderRadius: 12,
    },
    modalButtonText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
  });
}

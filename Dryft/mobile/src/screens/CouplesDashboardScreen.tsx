import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useDashboard, useDailyActivity } from '../hooks/useCouples';
import { useTimelineSummary } from '../hooks/useTimeline';
import DailyRewardWidget from '../components/DailyRewardWidget';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function CouplesDashboardScreen() {
  const navigation = useNavigation<any>();
  const { dashboard, loading, refresh } = useDashboard();
  const { activity: dailyActivity } = useDailyActivity();
  const { summary: timelineSummary } = useTimelineSummary();

  if (!dashboard?.has_couple) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noCoupleContainer}>
          <Text style={styles.noCoupleEmoji}>💕</Text>
          <Text style={styles.noCoupleTitle}>Connect with Your Partner</Text>
          <Text style={styles.noCoupleText}>
            Invite your partner to start your relationship journey together
          </Text>
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => navigation.navigate('InvitePartner')}
          >
            <Text style={styles.inviteButtonText}>Send Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.codeButton}
            onPress={() => navigation.navigate('EnterInviteCode')}
          >
            <Text style={styles.codeButtonText}>I Have an Invite Code</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { partner, stats, streak, recent_activities, upcoming_date } = dashboard;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#fff" />
        }
      >
        {/* Header with Partner */}
        <LinearGradient colors={['#6B46C1', '#EC4899']} style={styles.header}>
          <View style={styles.partnerRow}>
            <View style={styles.avatarContainer}>
              {partner?.profilePhoto ? (
                <Image source={{ uri: partner.profilePhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {partner?.displayName?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.heartBadge}>
                <Text>💕</Text>
              </View>
            </View>
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName}>{partner?.displayName}</Text>
              <Text style={styles.daysText}>
                {stats?.days_together || 0} days together
              </Text>
            </View>
          </View>

          {/* Level Progress */}
          <View style={styles.levelContainer}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelText}>Level {stats?.level || 1}</Text>
              <Text style={styles.xpText}>
                {stats?.xp || 0} / {stats?.xp_for_next_level || 100} XP
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(stats?.level_progress || 0) * 100}%` },
                ]}
              />
            </View>
          </View>
        </LinearGradient>

        {/* Daily Reward Widget */}
        <View style={styles.rewardWidgetContainer}>
          <DailyRewardWidget />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Timeline')}
          >
            <Text style={styles.actionEmoji}>📖</Text>
            <Text style={styles.actionText}>Timeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Activities')}
          >
            <Text style={styles.actionEmoji}>⭐</Text>
            <Text style={styles.actionText}>Activities</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Quizzes')}
          >
            <Text style={styles.actionEmoji}>🧠</Text>
            <Text style={styles.actionText}>Quizzes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Achievements')}
          >
            <Text style={styles.actionEmoji}>🏆</Text>
            <Text style={styles.actionText}>Badges</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Activity */}
        {dailyActivity && !dailyActivity.is_completed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Activity</Text>
            <TouchableOpacity
              style={styles.dailyCard}
              onPress={() =>
                navigation.navigate('ActivityDetail', { activityId: dailyActivity.id })
              }
            >
              <LinearGradient
                colors={['#4C1D95', '#7C3AED']}
                style={styles.dailyGradient}
              >
                <View style={styles.dailyContent}>
                  <Text style={styles.dailyIcon}>{dailyActivity.icon_url || '✨'}</Text>
                  <View style={styles.dailyInfo}>
                    <Text style={styles.dailyTitle}>{dailyActivity.title}</Text>
                    <Text style={styles.dailyDesc} numberOfLines={2}>
                      {dailyActivity.description}
                    </Text>
                    <View style={styles.dailyMeta}>
                      <Text style={styles.dailyXp}>+{dailyActivity.xp_reward} XP</Text>
                      {dailyActivity.streak_bonus ? (
                        <Text style={styles.dailyBonus}>
                          +{dailyActivity.streak_bonus} streak bonus!
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Upcoming Date */}
        {upcoming_date && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Date</Text>
            <TouchableOpacity
              style={styles.dateCard}
              onPress={() => navigation.navigate('DateDetail', { dateId: upcoming_date.id })}
            >
              <Text style={styles.dateIcon}>📅</Text>
              <View style={styles.dateInfo}>
                <Text style={styles.dateTitle}>{upcoming_date.title}</Text>
                <Text style={styles.dateTime}>
                  {new Date(upcoming_date.scheduled_at).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.dateArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Activity */}
        {recent_activities && recent_activities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ActivityHistory')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {recent_activities.slice(0, 3).map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityMeta}>
                    +{activity.xp_earned} XP •{' '}
                    {new Date(activity.completed_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Stats Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.relationship_score || 0}</Text>
              <Text style={styles.statLabel}>Relationship Score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.longest_streak || 0}</Text>
              <Text style={styles.statLabel}>Longest Streak</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  noCoupleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noCoupleEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  noCoupleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  noCoupleText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inviteButton: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  codeButtonText: {
    color: '#EC4899',
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    backgroundColor: '#4C1D95',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  heartBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
  },
  partnerInfo: {
    marginLeft: 16,
  },
  partnerName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  daysText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  levelContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelText: {
    color: '#fff',
    fontWeight: '600',
  },
  xpText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  rewardWidgetContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#1F1F2E',
    padding: 16,
    borderRadius: 16,
    width: (width - 64) / 4,
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  seeAll: {
    color: '#EC4899',
    fontSize: 14,
  },
  dailyCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  dailyGradient: {
    padding: 16,
  },
  dailyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  dailyInfo: {
    flex: 1,
  },
  dailyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dailyDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  dailyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyXp: {
    color: '#FCD34D',
    fontWeight: '600',
    marginRight: 12,
  },
  dailyBonus: {
    color: '#34D399',
    fontSize: 12,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F2E',
    padding: 16,
    borderRadius: 12,
  },
  dateIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateTime: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  dateArrow: {
    color: '#6B46C1',
    fontSize: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D3D',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B46C1',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  activityMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F1F2E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
});

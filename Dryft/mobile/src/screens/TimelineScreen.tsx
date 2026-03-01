import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTimeline, useThrowbacks } from '../hooks/useTimeline';
import type { TimelineEvent, UpcomingMilestone } from '../services/timeline';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const { width } = Dimensions.get('window');

type FilterType = 'all' | 'milestone' | 'memory' | 'achievement' | 'activity' | 'auto';

const FILTER_OPTIONS: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'milestone', label: 'Milestones', icon: '🎯' },
  { key: 'memory', label: 'Memories', icon: '📸' },
  { key: 'achievement', label: 'Achievements', icon: '🏆' },
  { key: 'activity', label: 'Activities', icon: '⭐' },
];

export default function TimelineScreen() {
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    events,
    stats,
    upcoming,
    partner,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  } = useTimeline(activeFilter === 'all' ? undefined : activeFilter);

  const { throwbacks, hasThrowbacks } = useThrowbacks();

  const renderHeader = useCallback(() => {
    if (!stats || !partner) return null;

    return (
      <View>
        {/* Stats Header */}
        <LinearGradient colors={[colors.accentSecondary, colors.accentPink]} style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.partnerInfo}>
              {partner.profile_photo ? (
                <Image source={{ uri: partner.profile_photo }} style={styles.partnerPhoto} />
              ) : (
                <View style={[styles.partnerPhoto, styles.partnerPhotoPlaceholder]}>
                  <Text style={styles.partnerPhotoText}>
                    {partner.display_name?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.partnerName}>{partner.display_name}</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{stats.days_together}</Text>
                <Text style={styles.mainStatLabel}>Days Together</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats.milestones_count}</Text>
                <Text style={styles.statLabel}>Milestones</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats.memories_count}</Text>
                <Text style={styles.statLabel}>Memories</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats.achievements_count}</Text>
                <Text style={styles.statLabel}>Achievements</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Throwbacks Section */}
        {hasThrowbacks && throwbacks.length > 0 && (
          <TouchableOpacity
            style={styles.throwbackCard}
            onPress={() => navigation.navigate('Throwbacks')}
          >
            <Text style={styles.throwbackIcon}>🔮</Text>
            <View style={styles.throwbackContent}>
              <Text style={styles.throwbackTitle}>On This Day</Text>
              <Text style={styles.throwbackSubtitle}>
                {throwbacks[0].years_ago} year{throwbacks[0].years_ago > 1 ? 's' : ''} ago
              </Text>
            </View>
            <Text style={styles.throwbackArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Upcoming Milestones */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coming Up</Text>
            <FlatList
              horizontal
              data={upcoming}
              keyExtractor={(item, index) => `upcoming-${index}`}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.upcomingCard}>
                  <Text style={styles.upcomingIcon}>{item.icon}</Text>
                  <Text style={styles.upcomingTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.upcomingDays}>
                    {item.days_until === 0 ? 'Today!' : `${item.days_until} days`}
                  </Text>
                </View>
              )}
            />
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={FILTER_OPTIONS}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  activeFilter === item.key && styles.filterTabActive,
                ]}
                onPress={() => setActiveFilter(item.key)}
              >
                <Text style={styles.filterIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === item.key && styles.filterTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <Text style={styles.timelineTitle}>Your Journey</Text>
      </View>
    );
  }, [stats, partner, upcoming, throwbacks, hasThrowbacks, activeFilter, navigation]);

  const renderTimelineEvent = useCallback(
    ({ item, index }: { item: TimelineEvent; index: number }) => {
      const isFirst = index === 0;
      const isLast = index === events.length - 1;

      return (
        <View style={styles.eventContainer}>
          {/* Timeline Line */}
          <View style={styles.timelineLine}>
            {!isFirst && <View style={styles.lineTop} />}
            <View style={[styles.dot, getDotStyle(item.type, colors)]} />
            {!isLast && <View style={styles.lineBottom} />}
          </View>

          {/* Event Card */}
          <TouchableOpacity
            style={styles.eventCard}
            onPress={() => {
              if (item.type === 'milestone') {
                navigation.navigate('MilestoneDetail', { milestoneId: item.id });
              } else if (item.type === 'memory') {
                navigation.navigate('MemoryDetail', { memoryId: item.id });
              }
            }}
          >
            <View style={styles.eventHeader}>
              <Text style={styles.eventIcon}>{item.icon || getDefaultIcon(item.type)}</Text>
              <View style={styles.eventMeta}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventDate}>
                  {formatDate(item.date)}
                </Text>
              </View>
            </View>

            {item.description && (
              <Text style={styles.eventDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            {(item.photo_url || item.media_url) && (
              <Image
                source={{ uri: item.photo_url || item.media_url || '' }}
                style={styles.eventImage}
                resizeMode="cover"
              />
            )}

            <View style={styles.eventTypeTag}>
              <Text style={styles.eventTypeText}>{formatType(item.type)}</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [events.length, navigation]
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.accentPink} />
      </View>
    );
  }, [loadingMore]);

  if (loading && events.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPink} />
          <Text style={styles.loadingText}>Loading your journey...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>😢</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderTimelineEvent}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🌟</Text>
            <Text style={styles.emptyTitle}>Start Your Story</Text>
            <Text style={styles.emptyText}>
              Add milestones and memories to build your timeline together
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddMilestone')}
            >
              <Text style={styles.addButtonText}>Add Milestone</Text>
            </TouchableOpacity>
          </View>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accentPink} />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddMemory')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatType(type: string): string {
  const types: Record<string, string> = {
    milestone: 'Milestone',
    memory: 'Memory',
    achievement: 'Achievement',
    activity: 'Activity',
    auto: 'Journey',
  };
  return types[type] || type;
}

function getDefaultIcon(type: string): string {
  const icons: Record<string, string> = {
    milestone: '🎯',
    memory: '📸',
    achievement: '🏆',
    activity: '⭐',
    auto: '💕',
  };
  return icons[type] || '📍';
}

function getDotStyle(type: string, themeColors: ThemeColors): object {
  const colorMap: Record<string, string> = {
    milestone: themeColors.accentPink,
    memory: themeColors.accent,
    achievement: themeColors.warning,
    activity: themeColors.success,
    auto: themeColors.accentSecondary,
  };
  return { backgroundColor: colorMap[type] || themeColors.accentSecondary };
}

// =============================================================================
// Styles
// =============================================================================

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

function createStyles(colors: ThemeColors) {
  const text80 = withAlpha(colors.text, 'CC');
  const text70 = withAlpha(colors.text, 'B3');
  const accent20 = withAlpha(colors.accent, '33');

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
    loadingText: {
      color: colors.textTertiary,
      marginTop: 12,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    errorIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 24,
    },
    retryButton: {
      backgroundColor: colors.accentSecondary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: colors.text,
      fontWeight: '600',
    },
    listContent: {
      paddingBottom: 100,
    },
    header: {
      padding: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerContent: {
      alignItems: 'center',
    },
    partnerInfo: {
      alignItems: 'center',
      marginBottom: 16,
    },
    partnerPhoto: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 3,
      borderColor: colors.text,
      marginBottom: 8,
    },
    partnerPhotoPlaceholder: {
      backgroundColor: colors.primaryDark,
      justifyContent: 'center',
      alignItems: 'center',
    },
    partnerPhotoText: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
    },
    partnerName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    statsContainer: {
      marginBottom: 16,
    },
    mainStat: {
      alignItems: 'center',
    },
    mainStatValue: {
      color: colors.text,
      fontSize: 48,
      fontWeight: 'bold',
    },
    mainStatLabel: {
      color: text80,
      fontSize: 14,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      backgroundColor: withAlpha(colors.text, '1A'),
      borderRadius: 12,
      padding: 12,
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: 'bold',
    },
    statLabel: {
      color: text70,
      fontSize: 12,
    },
    throwbackCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSecondary,
      margin: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.accentSecondary,
    },
    throwbackIcon: {
      fontSize: 32,
      marginRight: 12,
    },
    throwbackContent: {
      flex: 1,
    },
    throwbackTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    throwbackSubtitle: {
      color: colors.textTertiary,
      fontSize: 14,
    },
    throwbackArrow: {
      color: colors.accentSecondary,
      fontSize: 24,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    upcomingCard: {
      backgroundColor: colors.surfaceSecondary,
      padding: 16,
      borderRadius: 12,
      marginRight: 12,
      width: 120,
      alignItems: 'center',
    },
    upcomingIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    upcomingTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 4,
    },
    upcomingDays: {
      color: colors.accentPink,
      fontSize: 12,
      fontWeight: '600',
    },
    filterContainer: {
      marginTop: 24,
    },
    filterList: {
      paddingHorizontal: 16,
    },
    filterTab: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      marginRight: 8,
    },
    filterTabActive: {
      backgroundColor: colors.accentSecondary,
    },
    filterIcon: {
      fontSize: 16,
      marginRight: 6,
    },
    filterText: {
      color: colors.textTertiary,
      fontSize: 14,
    },
    filterTextActive: {
      color: colors.text,
      fontWeight: '600',
    },
    timelineTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 24,
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    eventContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
    },
    timelineLine: {
      width: 24,
      alignItems: 'center',
      marginRight: 12,
    },
    lineTop: {
      width: 2,
      flex: 1,
      backgroundColor: colors.borderLight,
    },
    lineBottom: {
      width: 2,
      flex: 1,
      backgroundColor: colors.borderLight,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accentSecondary,
      marginVertical: 4,
    },
    eventCard: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    eventHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    eventIcon: {
      fontSize: 28,
      marginRight: 12,
    },
    eventMeta: {
      flex: 1,
    },
    eventTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    eventDate: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: 4,
    },
    eventDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 12,
      lineHeight: 20,
    },
    eventImage: {
      width: '100%',
      height: 150,
      borderRadius: 8,
      marginTop: 12,
    },
    eventTypeTag: {
      marginTop: 12,
      alignSelf: 'flex-start',
      backgroundColor: accent20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    eventTypeText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '500',
    },
    loadingMore: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    addButton: {
      backgroundColor: colors.accentSecondary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    addButtonText: {
      color: colors.text,
      fontWeight: '600',
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPink,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.accentPink,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    fabText: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '300',
      marginTop: -2,
    },
  });
}

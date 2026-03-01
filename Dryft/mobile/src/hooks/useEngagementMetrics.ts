import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics, trackEvent } from '../services/analytics';

// ============================================================================
// Types
// ============================================================================

export interface EngagementMetrics {
  totalSessions: number;
  totalScreenViews: number;
  totalTimeSpentMs: number;
  averageSessionDurationMs: number;
  lastActiveAt: number;
  firstOpenAt: number;
  daysActive: number;
  streakDays: number;
  lastStreakDate: string;
  featureUsage: Record<string, number>;
}

interface SessionMetrics {
  startTime: number;
  screenViews: number;
  interactions: number;
  features: Set<string>;
}

// ============================================================================
// Storage Keys
// ============================================================================

const METRICS_KEYS = {
  TOTAL_SESSIONS: 'dryft_metrics_total_sessions',
  TOTAL_SCREEN_VIEWS: 'dryft_metrics_total_screen_views',
  TOTAL_TIME_SPENT: 'dryft_metrics_total_time_spent',
  FIRST_OPEN: 'dryft_metrics_first_open',
  LAST_ACTIVE: 'dryft_metrics_last_active',
  STREAK_DAYS: 'dryft_metrics_streak_days',
  LAST_STREAK_DATE: 'dryft_metrics_last_streak_date',
  DAYS_ACTIVE: 'dryft_metrics_days_active',
  ACTIVE_DATES: 'dryft_metrics_active_dates',
  FEATURE_USAGE: 'dryft_metrics_feature_usage',
};

// ============================================================================
// Engagement Metrics Hook
// ============================================================================

/**
 * React hook `useEngagementMetrics`.
 * @returns Hook state and actions.
 * @example
 * const value = useEngagementMetrics();
 */
export function useEngagementMetrics() {
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const sessionRef = useRef<SessionMetrics>({
    startTime: Date.now(),
    screenViews: 0,
    interactions: 0,
    features: new Set(),
  });

  // Load metrics on mount
  useEffect(() => {
    loadMetrics();
    startSession();

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      endSession();
    };
  }, []);

  const loadMetrics = async () => {
    try {
      const [
        totalSessions,
        totalScreenViews,
        totalTimeSpent,
        firstOpen,
        lastActive,
        streakDays,
        lastStreakDate,
        daysActive,
        featureUsage,
      ] = await Promise.all([
        AsyncStorage.getItem(METRICS_KEYS.TOTAL_SESSIONS),
        AsyncStorage.getItem(METRICS_KEYS.TOTAL_SCREEN_VIEWS),
        AsyncStorage.getItem(METRICS_KEYS.TOTAL_TIME_SPENT),
        AsyncStorage.getItem(METRICS_KEYS.FIRST_OPEN),
        AsyncStorage.getItem(METRICS_KEYS.LAST_ACTIVE),
        AsyncStorage.getItem(METRICS_KEYS.STREAK_DAYS),
        AsyncStorage.getItem(METRICS_KEYS.LAST_STREAK_DATE),
        AsyncStorage.getItem(METRICS_KEYS.DAYS_ACTIVE),
        AsyncStorage.getItem(METRICS_KEYS.FEATURE_USAGE),
      ]);

      const sessions = parseInt(totalSessions || '0', 10);
      const timeSpent = parseInt(totalTimeSpent || '0', 10);

      setMetrics({
        totalSessions: sessions,
        totalScreenViews: parseInt(totalScreenViews || '0', 10),
        totalTimeSpentMs: timeSpent,
        averageSessionDurationMs: sessions > 0 ? timeSpent / sessions : 0,
        lastActiveAt: parseInt(lastActive || '0', 10),
        firstOpenAt: parseInt(firstOpen || Date.now().toString(), 10),
        daysActive: parseInt(daysActive || '0', 10),
        streakDays: parseInt(streakDays || '0', 10),
        lastStreakDate: lastStreakDate || '',
        featureUsage: featureUsage ? JSON.parse(featureUsage) : {},
      });
    } catch (error) {
      console.error('[EngagementMetrics] Failed to load metrics:', error);
    }
  };

  const startSession = async () => {
    sessionRef.current = {
      startTime: Date.now(),
      screenViews: 0,
      interactions: 0,
      features: new Set(),
    };

    // Increment session count
    const current = await AsyncStorage.getItem(METRICS_KEYS.TOTAL_SESSIONS);
    const newCount = (parseInt(current || '0', 10) + 1).toString();
    await AsyncStorage.setItem(METRICS_KEYS.TOTAL_SESSIONS, newCount);

    // Update streak
    await updateStreak();

    // Set first open if not set
    const firstOpen = await AsyncStorage.getItem(METRICS_KEYS.FIRST_OPEN);
    if (!firstOpen) {
      await AsyncStorage.setItem(METRICS_KEYS.FIRST_OPEN, Date.now().toString());
    }
  };

  const endSession = async () => {
    const sessionDuration = Date.now() - sessionRef.current.startTime;

    // Update total time spent
    const current = await AsyncStorage.getItem(METRICS_KEYS.TOTAL_TIME_SPENT);
    const newTotal = (parseInt(current || '0', 10) + sessionDuration).toString();
    await AsyncStorage.setItem(METRICS_KEYS.TOTAL_TIME_SPENT, newTotal);

    // Update last active
    await AsyncStorage.setItem(METRICS_KEYS.LAST_ACTIVE, Date.now().toString());

    // Update total screen views
    const screenViews = await AsyncStorage.getItem(METRICS_KEYS.TOTAL_SCREEN_VIEWS);
    const newViews = (parseInt(screenViews || '0', 10) + sessionRef.current.screenViews).toString();
    await AsyncStorage.setItem(METRICS_KEYS.TOTAL_SCREEN_VIEWS, newViews);

    // Track session end with metrics
    trackEvent('session_end', {
      session_duration_ms: sessionDuration,
      screen_views: sessionRef.current.screenViews,
      interactions: sessionRef.current.interactions,
      features_used: Array.from(sessionRef.current.features),
    });
  };

  const handleAppStateChange = async (state: AppStateStatus) => {
    if (state === 'active') {
      await startSession();
    } else if (state === 'background') {
      await endSession();
    }
  };

  const updateStreak = async () => {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = await AsyncStorage.getItem(METRICS_KEYS.LAST_STREAK_DATE);
    let streak = parseInt((await AsyncStorage.getItem(METRICS_KEYS.STREAK_DAYS)) || '0', 10);

    if (lastDate === today) {
      // Already counted today
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayStr) {
      // Continue streak
      streak++;
    } else if (lastDate !== today) {
      // Streak broken, start new
      streak = 1;
    }

    await AsyncStorage.setItem(METRICS_KEYS.STREAK_DAYS, streak.toString());
    await AsyncStorage.setItem(METRICS_KEYS.LAST_STREAK_DATE, today);

    // Update unique days active
    const activeDates = await AsyncStorage.getItem(METRICS_KEYS.ACTIVE_DATES);
    const dates: string[] = activeDates ? JSON.parse(activeDates) : [];
    if (!dates.includes(today)) {
      dates.push(today);
      await AsyncStorage.setItem(METRICS_KEYS.ACTIVE_DATES, JSON.stringify(dates));
      await AsyncStorage.setItem(METRICS_KEYS.DAYS_ACTIVE, dates.length.toString());
    }

    // Reload metrics
    await loadMetrics();
  };

  const trackScreenView = useCallback(() => {
    sessionRef.current.screenViews++;
  }, []);

  const trackInteraction = useCallback(() => {
    sessionRef.current.interactions++;
  }, []);

  const trackFeatureUse = useCallback(async (featureName: string) => {
    sessionRef.current.features.add(featureName);

    // Update persistent feature usage
    try {
      const stored = await AsyncStorage.getItem(METRICS_KEYS.FEATURE_USAGE);
      const usage: Record<string, number> = stored ? JSON.parse(stored) : {};
      usage[featureName] = (usage[featureName] || 0) + 1;
      await AsyncStorage.setItem(METRICS_KEYS.FEATURE_USAGE, JSON.stringify(usage));
    } catch (error) {
      console.error('[EngagementMetrics] Failed to track feature:', error);
    }
  }, []);

  const getRetentionMetrics = useCallback(() => {
    if (!metrics) return null;

    const daysSinceFirstOpen = Math.floor(
      (Date.now() - metrics.firstOpenAt) / (1000 * 60 * 60 * 24)
    );

    const retentionRate = daysSinceFirstOpen > 0
      ? (metrics.daysActive / daysSinceFirstOpen) * 100
      : 100;

    return {
      daysSinceFirstOpen,
      retentionRate: Math.round(retentionRate),
      averageSessionsPerDay: metrics.daysActive > 0
        ? metrics.totalSessions / metrics.daysActive
        : metrics.totalSessions,
    };
  }, [metrics]);

  return {
    metrics,
    trackScreenView,
    trackInteraction,
    trackFeatureUse,
    getRetentionMetrics,
    refreshMetrics: loadMetrics,
  };
}

// ============================================================================
// Scroll Depth Tracking Hook
// ============================================================================

/**
 * React hook `useScrollDepthTracking`.
 * @param screenName - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useScrollDepthTracking(screenName);
 */
export function useScrollDepthTracking(screenName: string) {
  const maxDepthRef = useRef(0);
  const reportedDepthsRef = useRef<Set<number>>(new Set());

  const trackScrollDepth = useCallback((scrollPercentage: number) => {
    const depth = Math.floor(scrollPercentage / 25) * 25; // 0, 25, 50, 75, 100

    if (depth > maxDepthRef.current) {
      maxDepthRef.current = depth;
    }

    // Report at milestones
    if (depth >= 25 && !reportedDepthsRef.current.has(25)) {
      reportedDepthsRef.current.add(25);
      trackEvent('screen_view', { screen_name: screenName, scroll_depth: 25 });
    }
    if (depth >= 50 && !reportedDepthsRef.current.has(50)) {
      reportedDepthsRef.current.add(50);
      trackEvent('screen_view', { screen_name: screenName, scroll_depth: 50 });
    }
    if (depth >= 75 && !reportedDepthsRef.current.has(75)) {
      reportedDepthsRef.current.add(75);
      trackEvent('screen_view', { screen_name: screenName, scroll_depth: 75 });
    }
    if (depth >= 100 && !reportedDepthsRef.current.has(100)) {
      reportedDepthsRef.current.add(100);
      trackEvent('screen_view', { screen_name: screenName, scroll_depth: 100 });
    }
  }, [screenName]);

  const onScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollableHeight = contentSize.height - layoutMeasurement.height;

    if (scrollableHeight > 0) {
      const percentage = (contentOffset.y / scrollableHeight) * 100;
      trackScrollDepth(Math.min(100, Math.max(0, percentage)));
    }
  }, [trackScrollDepth]);

  const reset = useCallback(() => {
    maxDepthRef.current = 0;
    reportedDepthsRef.current.clear();
  }, []);

  return {
    onScroll,
    maxDepth: maxDepthRef.current,
    reset,
  };
}

// ============================================================================
// Content Engagement Tracking
// ============================================================================

/**
 * React hook `useContentEngagement`.
 * @param contentId - Hook parameter.
 * @param contentType - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useContentEngagement(contentId, contentType);
 */
export function useContentEngagement(contentId: string, contentType: string) {
  const startTimeRef = useRef<number>(Date.now());
  const viewDurationRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(true);
  const interactionsRef = useRef<string[]>([]);

  useEffect(() => {
    startTimeRef.current = Date.now();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startTimeRef.current = Date.now();
        isActiveRef.current = true;
      } else {
        if (isActiveRef.current) {
          viewDurationRef.current += Date.now() - startTimeRef.current;
        }
        isActiveRef.current = false;
      }
    });

    return () => {
      subscription.remove();

      // Track final engagement
      if (isActiveRef.current) {
        viewDurationRef.current += Date.now() - startTimeRef.current;
      }

      trackEvent('profile_viewed', {
        content_id: contentId,
        type: contentType,
        view_duration_ms: viewDurationRef.current,
        interactions: interactionsRef.current,
        interaction_count: interactionsRef.current.length,
      });
    };
  }, [contentId, contentType]);

  const trackInteraction = useCallback((interactionType: string) => {
    interactionsRef.current.push(interactionType);
  }, []);

  return {
    trackInteraction,
    getViewDuration: () => {
      if (isActiveRef.current) {
        return viewDurationRef.current + (Date.now() - startTimeRef.current);
      }
      return viewDurationRef.current;
    },
  };
}

// ============================================================================
// Feature Discovery Tracking
// ============================================================================

const DISCOVERED_FEATURES_KEY = 'dryft_discovered_features';

/**
 * React hook `useFeatureDiscovery`.
 * @returns Hook state and actions.
 * @example
 * const value = useFeatureDiscovery();
 */
export function useFeatureDiscovery() {
  const [discoveredFeatures, setDiscoveredFeatures] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDiscoveredFeatures();
  }, []);

  const loadDiscoveredFeatures = async () => {
    try {
      const stored = await AsyncStorage.getItem(DISCOVERED_FEATURES_KEY);
      if (stored) {
        setDiscoveredFeatures(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('[FeatureDiscovery] Failed to load:', error);
    }
  };

  const markFeatureDiscovered = useCallback(async (featureName: string) => {
    if (discoveredFeatures.has(featureName)) return;

    const newSet = new Set(discoveredFeatures);
    newSet.add(featureName);
    setDiscoveredFeatures(newSet);

    try {
      await AsyncStorage.setItem(DISCOVERED_FEATURES_KEY, JSON.stringify([...newSet]));
    } catch (error) {
      console.error('[FeatureDiscovery] Failed to save:', error);
    }

    // Track discovery
    trackEvent('screen_view', {
      feature_name: featureName,
      total_features_discovered: newSet.size,
    });
  }, [discoveredFeatures]);

  const isFeatureDiscovered = useCallback((featureName: string) => {
    return discoveredFeatures.has(featureName);
  }, [discoveredFeatures]);

  return {
    discoveredFeatures: [...discoveredFeatures],
    markFeatureDiscovered,
    isFeatureDiscovered,
    totalDiscovered: discoveredFeatures.size,
  };
}

// ============================================================================
// User Journey Tracking
// ============================================================================

/**
 * React hook `useUserJourney`.
 * @returns Hook state and actions.
 * @example
 * const value = useUserJourney();
 */
export function useUserJourney() {
  const journeyRef = useRef<Array<{ screen: string; timestamp: number; duration?: number }>>([]);
  const currentScreenRef = useRef<{ screen: string; timestamp: number } | null>(null);

  const enterScreen = useCallback((screenName: string) => {
    // Complete previous screen
    if (currentScreenRef.current) {
      const duration = Date.now() - currentScreenRef.current.timestamp;
      journeyRef.current[journeyRef.current.length - 1].duration = duration;
    }

    // Start new screen
    const entry = { screen: screenName, timestamp: Date.now() };
    journeyRef.current.push(entry);
    currentScreenRef.current = entry;

    // Limit journey length
    if (journeyRef.current.length > 50) {
      journeyRef.current = journeyRef.current.slice(-50);
    }
  }, []);

  const getJourney = useCallback(() => {
    // Complete current screen if active
    if (currentScreenRef.current) {
      const lastEntry = journeyRef.current[journeyRef.current.length - 1];
      if (lastEntry && !lastEntry.duration) {
        lastEntry.duration = Date.now() - currentScreenRef.current.timestamp;
      }
    }

    return [...journeyRef.current];
  }, []);

  const getJourneySummary = useCallback(() => {
    const journey = getJourney();
    const screenCounts: Record<string, number> = {};
    const screenDurations: Record<string, number> = {};

    journey.forEach((entry) => {
      screenCounts[entry.screen] = (screenCounts[entry.screen] || 0) + 1;
      screenDurations[entry.screen] =
        (screenDurations[entry.screen] || 0) + (entry.duration || 0);
    });

    return {
      totalScreens: journey.length,
      uniqueScreens: Object.keys(screenCounts).length,
      screenCounts,
      screenDurations,
      path: journey.map((e) => e.screen),
    };
  }, [getJourney]);

  return {
    enterScreen,
    getJourney,
    getJourneySummary,
  };
}

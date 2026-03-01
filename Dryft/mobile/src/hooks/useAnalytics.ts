import { useEffect, useCallback, useRef } from 'react';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { AppState, AppStateStatus } from 'react-native';
import {
  analytics,
  trackEvent,
  trackScreen,
  trackingHelpers,
  AnalyticsEventName,
} from '../services/analytics';

// Auto screen tracking hook
/**
 * React hook `useScreenTracking`.
 * @param screenName? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useScreenTracking(screenName?);
 */
export function useScreenTracking(screenName?: string) {
  const route = useRoute();
  const name = screenName || route.name;

  useFocusEffect(
    useCallback(() => {
      trackScreen(name, { params: route.params });

      return () => {
        analytics.trackScreenExit(name);
      };
    }, [name, route.params])
  );
}

// Track time spent on screen
/**
 * React hook `useScreenTime`.
 * @param screenName? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useScreenTime(screenName?);
 */
export function useScreenTime(screenName?: string) {
  const route = useRoute();
  const name = screenName || route.name;
  const startTime = useRef<number>(0);

  useFocusEffect(
    useCallback(() => {
      startTime.current = Date.now();

      return () => {
        const duration = Date.now() - startTime.current;
        trackEvent('screen_view', {
          screen_name: name,
          duration_ms: duration,
        });
      };
    }, [name])
  );
}

// Track app state changes
/**
 * React hook `useAppStateTracking`.
 * @returns Hook state and actions.
 * @example
 * const value = useAppStateTracking();
 */
export function useAppStateTracking() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        trackEvent('app_foregrounded' as AnalyticsEventName, {});
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        trackEvent('app_backgrounded' as AnalyticsEventName, {});
        analytics.flush();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

// Track button/action with timing
export function useTrackedAction<T extends (...args: any[]) => any>(
  eventName: AnalyticsEventName,
  action: T,
  getProperties?: (...args: Parameters<T>) => Record<string, any>
): T {
  return useCallback(
    ((...args: Parameters<T>) => {
      const startTime = Date.now();
      const result = action(...args);

      const properties = getProperties ? getProperties(...args) : {};

      // Handle async actions
      if (result instanceof Promise) {
        result
          .then(() => {
            trackEvent(eventName, {
              ...properties,
              duration_ms: Date.now() - startTime,
              success: true,
            });
          })
          .catch((error) => {
            trackEvent(eventName, {
              ...properties,
              duration_ms: Date.now() - startTime,
              success: false,
              error: error.message,
            });
          });
      } else {
        trackEvent(eventName, properties);
      }

      return result;
    }) as T,
    [eventName, action, getProperties]
  );
}

// Track scroll depth
/**
 * React hook `useScrollTracking`.
 * @param contentName - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useScrollTracking(contentName);
 */
export function useScrollTracking(contentName: string) {
  const maxScrollDepth = useRef(0);
  const hasTracked25 = useRef(false);
  const hasTracked50 = useRef(false);
  const hasTracked75 = useRef(false);
  const hasTracked100 = useRef(false);

  const onScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const scrollDepth = (contentOffset.y + layoutMeasurement.height) / contentSize.height;
      const percentage = Math.min(100, Math.round(scrollDepth * 100));

      if (percentage > maxScrollDepth.current) {
        maxScrollDepth.current = percentage;

        // Track milestones
        if (percentage >= 25 && !hasTracked25.current) {
          hasTracked25.current = true;
          trackEvent('scroll_depth' as AnalyticsEventName, { content: contentName, depth: 25 });
        }
        if (percentage >= 50 && !hasTracked50.current) {
          hasTracked50.current = true;
          trackEvent('scroll_depth' as AnalyticsEventName, { content: contentName, depth: 50 });
        }
        if (percentage >= 75 && !hasTracked75.current) {
          hasTracked75.current = true;
          trackEvent('scroll_depth' as AnalyticsEventName, { content: contentName, depth: 75 });
        }
        if (percentage >= 100 && !hasTracked100.current) {
          hasTracked100.current = true;
          trackEvent('scroll_depth' as AnalyticsEventName, { content: contentName, depth: 100 });
        }
      }
    },
    [contentName]
  );

  const reset = useCallback(() => {
    maxScrollDepth.current = 0;
    hasTracked25.current = false;
    hasTracked50.current = false;
    hasTracked75.current = false;
    hasTracked100.current = false;
  }, []);

  return { onScroll, reset, maxScrollDepth: maxScrollDepth.current };
}

// Track feature usage
/**
 * React hook `useFeatureTracking`.
 * @param featureName - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useFeatureTracking(featureName);
 */
export function useFeatureTracking(featureName: string) {
  const usageCount = useRef(0);
  const firstUseTime = useRef<number | null>(null);

  const trackUsage = useCallback(
    (action: string, properties?: Record<string, any>) => {
      usageCount.current++;

      if (firstUseTime.current === null) {
        firstUseTime.current = Date.now();
        trackEvent('feature_first_use' as AnalyticsEventName, {
          feature: featureName,
          action,
          ...properties,
        });
      }

      trackEvent('feature_used' as AnalyticsEventName, {
        feature: featureName,
        action,
        usage_count: usageCount.current,
        ...properties,
      });
    },
    [featureName]
  );

  return trackUsage;
}

// Match tracking helpers
/**
 * React hook `useMatchTracking`.
 * @returns Hook state and actions.
 * @example
 * const value = useMatchTracking();
 */
export function useMatchTracking() {
  const trackProfileView = useCallback((profileId: string, source: string) => {
    trackingHelpers.trackProfileView(profileId);
    trackEvent('profile_viewed', { profile_id: profileId, source });
  }, []);

  const trackSwipe = useCallback(
    (profileId: string, direction: 'left' | 'right' | 'up', viewDuration: number) => {
      if (direction === 'right') {
        trackingHelpers.trackLike(profileId);
      } else if (direction === 'up') {
        trackEvent('profile_super_liked', { profile_id: profileId, view_duration: viewDuration });
      } else {
        trackingHelpers.trackPass(profileId);
      }
    },
    []
  );

  const trackMatch = useCallback((matchId: string, profileId: string, isInstant: boolean) => {
    trackingHelpers.trackMatch(matchId, profileId);
    trackEvent('match_created', {
      match_id: matchId,
      profile_id: profileId,
      is_instant: isInstant,
    });
  }, []);

  return { trackProfileView, trackSwipe, trackMatch };
}

// Chat tracking helpers
/**
 * React hook `useChatTracking`.
 * @param matchId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useChatTracking(matchId);
 */
export function useChatTracking(matchId: string) {
  const messageCount = useRef(0);
  const sessionStart = useRef(Date.now());

  const trackMessageSent = useCallback(
    (type: 'text' | 'image' | 'voice' | 'gif') => {
      messageCount.current++;
      trackingHelpers.trackMessageSent(matchId, type);
    },
    [matchId]
  );

  const trackChatOpened = useCallback(() => {
    sessionStart.current = Date.now();
    messageCount.current = 0;
    trackEvent('chat_opened', { match_id: matchId });
  }, [matchId]);

  const trackChatClosed = useCallback(() => {
    const duration = Date.now() - sessionStart.current;
    trackEvent('chat_closed' as AnalyticsEventName, {
      match_id: matchId,
      duration_ms: duration,
      messages_sent: messageCount.current,
    });
  }, [matchId]);

  return { trackMessageSent, trackChatOpened, trackChatClosed };
}

// Purchase tracking
/**
 * React hook `usePurchaseTracking`.
 * @returns Hook state and actions.
 * @example
 * const value = usePurchaseTracking();
 */
export function usePurchaseTracking() {
  const trackPurchaseFlow = useCallback(
    (itemId: string, itemName: string, price: number, currency: string = 'USD') => {
      return {
        onViewItem: () => {
          trackEvent('item_viewed', { item_id: itemId, item_name: itemName, price, currency });
        },
        onAddToCart: () => {
          trackEvent('add_to_cart' as AnalyticsEventName, { item_id: itemId, price, currency });
        },
        onBeginCheckout: () => {
          trackingHelpers.trackPurchaseStart(itemId, price);
        },
        onPurchaseComplete: (transactionId: string) => {
          trackingHelpers.trackPurchaseComplete(itemId, price, transactionId);
        },
        onPurchaseFailed: (error: string) => {
          trackingHelpers.trackPurchaseFail(itemId, error);
        },
      };
    },
    []
  );

  return trackPurchaseFlow;
}

// Error boundary tracking
/**
 * React hook `useErrorTracking`.
 * @returns Hook state and actions.
 * @example
 * const value = useErrorTracking();
 */
export function useErrorTracking() {
  const trackError = useCallback((error: Error, context?: Record<string, any>) => {
    trackingHelpers.trackError(error, context);
  }, []);

  const trackWarning = useCallback((message: string, context?: Record<string, any>) => {
    trackEvent('warning_occurred' as AnalyticsEventName, {
      message,
      ...context,
    });
  }, []);

  return { trackError, trackWarning };
}

// Export all tracking helpers for direct use
export { trackingHelpers };

import { useState, useEffect, useCallback } from 'react';
import * as timelineService from '../services/timeline';
import type {
  TimelineEvent,
  TimelineStats,
  UpcomingMilestone,
  ThrowbackYear,
  TimelineSummary,
} from '../services/timeline';

// =============================================================================
// Full Timeline Hook
// =============================================================================

/**
 * React hook `useTimeline`.
 * @param type? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useTimeline(type?);
 */
export function useTimeline(type?: string) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingMilestone[]>([]);
  const [partner, setPartner] = useState<{
    id: string;
    display_name: string | null;
    profile_photo: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        const offset = reset ? 0 : events.length;
        const data = await timelineService.getTimeline({
          limit: 20,
          offset,
          type,
        });

        if (reset) {
          setEvents(data.timeline);
        } else {
          setEvents((prev) => [...prev, ...data.timeline]);
        }

        setStats(data.stats);
        setUpcoming(data.upcoming);
        setPartner(data.partner);
        setHasMore(data.has_more);
      } catch (err: any) {
        setError(err.message || 'Failed to load timeline');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [events.length, type]
  );

  useEffect(() => {
    fetchTimeline(true);
  }, [type]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      fetchTimeline(false);
    }
  }, [loading, loadingMore, hasMore, fetchTimeline]);

  const refresh = useCallback(() => {
    fetchTimeline(true);
  }, [fetchTimeline]);

  return {
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
  };
}

// =============================================================================
// Timeline Summary Hook (for Dashboard Widget)
// =============================================================================

/**
 * React hook `useTimelineSummary`.
 * @returns Hook state and actions.
 * @example
 * const value = useTimelineSummary();
 */
export function useTimelineSummary() {
  const [summary, setSummary] = useState<TimelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await timelineService.getTimelineSummary();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refresh: fetchSummary };
}

// =============================================================================
// Throwbacks Hook ("On This Day")
// =============================================================================

/**
 * React hook `useThrowbacks`.
 * @returns Hook state and actions.
 * @example
 * const value = useThrowbacks();
 */
export function useThrowbacks() {
  const [throwbacks, setThrowbacks] = useState<ThrowbackYear[]>([]);
  const [hasThrowbacks, setHasThrowbacks] = useState(false);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThrowbacks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await timelineService.getThrowbacks();
      setThrowbacks(data.throwbacks);
      setHasThrowbacks(data.has_throwbacks);
      setDate(data.date);
    } catch (err: any) {
      setError(err.message || 'Failed to load throwbacks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThrowbacks();
  }, [fetchThrowbacks]);

  return { throwbacks, hasThrowbacks, date, loading, error, refresh: fetchThrowbacks };
}

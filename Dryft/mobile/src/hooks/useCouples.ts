import { useState, useEffect, useCallback } from 'react';
import * as couplesService from '../services/couples';
import type {
  Couple,
  Dashboard,
  Activity,
  Quiz,
  QuizQuestion,
  Achievement,
  DatePlan,
  DateIdea,
  Milestone,
  Memory,
} from '../services/couples';

// =============================================================================
// Dashboard Hook
// =============================================================================

/**
 * React hook `useDashboard`.
 * @returns Hook state and actions.
 * @example
 * const value = useDashboard();
 */
export function useDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await couplesService.getDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { dashboard, loading, error, refresh: fetchDashboard };
}

// =============================================================================
// Couple Management Hooks
// =============================================================================

/**
 * React hook `useCouple`.
 * @returns Hook state and actions.
 * @example
 * const value = useCouple();
 */
export function useCouple() {
  const [couple, setCouple] = useState<Couple | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCouple = useCallback(async () => {
    try {
      setLoading(true);
      const { couple } = await couplesService.getCurrentCouple();
      setCouple(couple);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCouple();
  }, [fetchCouple]);

  const sendInvite = async (params: {
    partner_email: string;
    relationship_type?: string;
    anniversary?: string;
  }) => {
    const result = await couplesService.sendCoupleInvite(params);
    await fetchCouple();
    return result;
  };

  const acceptInvite = async (invite_code: string) => {
    const result = await couplesService.acceptCoupleInvite(invite_code);
    await fetchCouple();
    return result;
  };

  const updateSettings = async (params: {
    nickname?: string;
    relationship_type?: string;
    anniversary?: string;
  }) => {
    await couplesService.updateCoupleSettings(params);
    await fetchCouple();
  };

  return {
    couple,
    loading,
    error,
    refresh: fetchCouple,
    sendInvite,
    acceptInvite,
    updateSettings,
  };
}

// =============================================================================
// Activities Hooks
// =============================================================================

export function useActivities(params?: {
  category?: string;
  difficulty?: string;
  daily?: boolean;
  weekly?: boolean;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const { activities } = await couplesService.getActivities(params);
      setActivities(activities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [params?.category, params?.difficulty, params?.daily, params?.weekly]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, error, refresh: fetchActivities };
}

/**
 * React hook `useDailyActivity`.
 * @returns Hook state and actions.
 * @example
 * const value = useDailyActivity();
 */
export function useDailyActivity() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDaily = useCallback(async () => {
    try {
      setLoading(true);
      const { daily_activity } = await couplesService.getDailyActivity();
      setActivity(daily_activity);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  return { activity, loading, error, refresh: fetchDaily };
}

/**
 * React hook `useActivity`.
 * @param activityId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useActivity(activityId);
 */
export function useActivity(activityId: string) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const { activity } = await couplesService.getActivity(activityId);
        setActivity(activity);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [activityId]);

  const start = async () => {
    return couplesService.startActivity(activityId);
  };

  const submit = async (params: { response?: any; rating?: number }) => {
    try {
      setSubmitting(true);
      const res = await couplesService.submitActivity(activityId, params);
      setResult(res);
      return res;
    } finally {
      setSubmitting(false);
    }
  };

  return { activity, loading, submitting, result, start, submit };
}

// =============================================================================
// Quiz Hooks
// =============================================================================

/**
 * React hook `useQuizzes`.
 * @param category? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useQuizzes(category?);
 */
export function useQuizzes(category?: string) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const [quizzesRes, categoriesRes] = await Promise.all([
        couplesService.getQuizzes(category),
        couplesService.getQuizCategories(),
      ]);
      setQuizzes(quizzesRes.quizzes);
      setCategories(categoriesRes.categories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  return { quizzes, categories, loading, error, refresh: fetchQuizzes };
}

/**
 * React hook `useQuiz`.
 * @param quizId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useQuiz(quizId);
 */
export function useQuiz(quizId: string) {
  const [quiz, setQuiz] = useState<(Quiz & { questions: QuizQuestion[] }) | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const { quiz } = await couplesService.getQuiz(quizId);
        setQuiz(quiz);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [quizId]);

  const start = async () => {
    const res = await couplesService.startQuiz(quizId);
    setAttemptId(res.attempt_id);
    return res;
  };

  const submit = async (answers: { question_id: string; answer: any }[]) => {
    if (!attemptId) throw new Error('Quiz not started');
    try {
      setSubmitting(true);
      const res = await couplesService.submitQuiz(quizId, { attempt_id: attemptId, answers });
      setResult(res);
      return res;
    } finally {
      setSubmitting(false);
    }
  };

  return { quiz, attemptId, loading, submitting, result, start, submit };
}

// =============================================================================
// Date Hooks
// =============================================================================

/**
 * React hook `useDates`.
 * @returns Hook state and actions.
 * @example
 * const value = useDates();
 */
export function useDates() {
  const [upcoming, setUpcoming] = useState<DatePlan[]>([]);
  const [past, setPast] = useState<DatePlan[]>([]);
  const [ideas, setIdeas] = useState<DateIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDates = useCallback(async () => {
    try {
      setLoading(true);
      const [upcomingRes, pastRes, ideasRes] = await Promise.all([
        couplesService.getUpcomingDates(),
        couplesService.getPastDates({ limit: 10 }),
        couplesService.getDateIdeas(),
      ]);
      setUpcoming(upcomingRes.dates);
      setPast(pastRes.dates);
      setIdeas(ideasRes.ideas);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  const createDate = async (params: Parameters<typeof couplesService.createDate>[0]) => {
    const result = await couplesService.createDate(params);
    await fetchDates();
    return result;
  };

  const confirmDate = async (dateId: string) => {
    await couplesService.confirmDate(dateId);
    await fetchDates();
  };

  const cancelDate = async (dateId: string) => {
    await couplesService.cancelDate(dateId);
    await fetchDates();
  };

  const completeDate = async (dateId: string, params: { rating?: number; notes?: string }) => {
    const result = await couplesService.completeDate(dateId, params);
    await fetchDates();
    return result;
  };

  return {
    upcoming,
    past,
    ideas,
    loading,
    error,
    refresh: fetchDates,
    createDate,
    confirmDate,
    cancelDate,
    completeDate,
  };
}

// =============================================================================
// Achievement Hooks
// =============================================================================

/**
 * React hook `useAchievements`.
 * @param category? - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useAchievements(category?);
 */
export function useAchievements(category?: string) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [earned, setEarned] = useState<Achievement[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    try {
      setLoading(true);
      const [allRes, earnedRes] = await Promise.all([
        couplesService.getAchievements(category),
        couplesService.getEarnedAchievements(),
      ]);
      setAchievements(allRes.achievements);
      setEarned(earnedRes.achievements);
      setTotalXp(earnedRes.total_xp);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  return { achievements, earned, totalXp, loading, error, refresh: fetchAchievements };
}

/**
 * React hook `useLeaderboard`.
 * @param type - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useLeaderboard(type);
 */
export function useLeaderboard(type: 'xp' | 'streak' = 'xp') {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await couplesService.getLeaderboard(type);
        setLeaderboard(res.leaderboard);
        setUserRank(res.user_rank);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [type]);

  return { leaderboard, userRank, loading };
}

// =============================================================================
// Milestones & Memories Hooks
// =============================================================================

/**
 * React hook `useMilestones`.
 * @returns Hook state and actions.
 * @example
 * const value = useMilestones();
 */
export function useMilestones() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMilestones = useCallback(async () => {
    try {
      setLoading(true);
      const { milestones } = await couplesService.getMilestones();
      setMilestones(milestones);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const addMilestone = async (params: Parameters<typeof couplesService.addMilestone>[0]) => {
    const result = await couplesService.addMilestone(params);
    await fetchMilestones();
    return result;
  };

  return { milestones, loading, refresh: fetchMilestones, addMilestone };
}

/**
 * React hook `useMemories`.
 * @returns Hook state and actions.
 * @example
 * const value = useMemories();
 */
export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const fetchMemories = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const offset = reset ? 0 : memories.length;
      const { memories: newMemories } = await couplesService.getMemories({ limit: 20, offset });

      if (reset) {
        setMemories(newMemories);
      } else {
        setMemories(prev => [...prev, ...newMemories]);
      }
      setHasMore(newMemories.length === 20);
    } finally {
      setLoading(false);
    }
  }, [memories.length]);

  useEffect(() => {
    fetchMemories(true);
  }, []);

  const addMemory = async (params: Parameters<typeof couplesService.addMemory>[0]) => {
    const result = await couplesService.addMemory(params);
    await fetchMemories(true);
    return result;
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchMemories(false);
    }
  };

  return { memories, loading, hasMore, refresh: () => fetchMemories(true), loadMore, addMemory };
}

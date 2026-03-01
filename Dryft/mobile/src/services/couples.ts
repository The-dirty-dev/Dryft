import { apiClient } from './api';

// =============================================================================
// Types
// =============================================================================

export interface Partner {
  id: string;
  displayName: string;
  profilePhoto?: string;
}

export interface Couple {
  id: string;
  partner: Partner;
  relationship_type: string;
  anniversary?: string;
  nickname?: string;
  level: number;
  xp: number;
  current_streak: number;
  longest_streak: number;
  relationship_score: number;
  last_activity_at?: string;
  created_at: string;
}

export interface CoupleStats {
  level: number;
  xp: number;
  xp_for_next_level: number;
  level_progress: number;
  current_streak: number;
  longest_streak: number;
  relationship_score: number;
  days_together: number;
}

export interface StreakInfo {
  current: number;
  completed_today: boolean;
  streak_at_risk: boolean;
}

export interface Dashboard {
  has_couple: boolean;
  partner?: Partner;
  stats?: CoupleStats;
  streak?: StreakInfo;
  recent_activities: RecentActivity[];
  upcoming_date?: UpcomingDate;
}

export interface RecentActivity {
  id: string;
  title: string;
  category: string;
  completed_at: string;
  xp_earned: number;
}

export interface UpcomingDate {
  id: string;
  title: string;
  scheduled_at: string;
  type: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  category: string;
  difficulty: string;
  duration: number;
  is_virtual: boolean;
  requires_both: boolean;
  xp_reward: number;
  icon_url?: string;
  image_url?: string;
  is_daily: boolean;
  is_weekly: boolean;
  is_premium: boolean;
  is_completed: boolean;
  streak_bonus?: number;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  question_count: number;
  time_limit?: number;
  xp_reward: number;
  icon_url?: string;
  image_url?: string;
  is_premium: boolean;
  is_attempted: boolean;
}

export interface QuizQuestion {
  id: string;
  question_type: string;
  question: string;
  options?: string[];
  is_about_partner: boolean;
  points: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  xp_reward: number;
  icon_url?: string;
  badge_url?: string;
  is_earned: boolean;
  earned_at?: string;
  progress: number;
}

export interface DatePlan {
  id: string;
  title: string;
  description?: string;
  date_type: string;
  scheduled_at: string;
  duration?: number;
  location?: string;
  meeting_url?: string;
  status: string;
  created_by?: Partner;
  is_mine: boolean;
}

export interface DateIdea {
  type: string;
  title: string;
  description: string;
  duration: number;
  icon: string;
}

export interface Milestone {
  id: string;
  type: string;
  title: string;
  description?: string;
  date: string;
  photo_url?: string;
}

export interface Memory {
  id: string;
  type: string;
  title?: string;
  content?: string;
  media_url?: string;
  location?: string;
  mood?: string;
  created_at: string;
}

// =============================================================================
// Couple Management
// =============================================================================

export async function getCurrentCouple(): Promise<{ couple: Couple | null }> {
  const r = await apiClient.get<{ couple: Couple | null }>('/couples/current');
  return r.data ?? { couple: null };
}

export async function sendCoupleInvite(params: {
  partner_email: string;
  relationship_type?: string;
  anniversary?: string;
}): Promise<{ couple_id: string; invite_code: string }> {
  const r = await apiClient.post<{ couple_id: string; invite_code: string }>('/couples/invite', params);
  return r.data!;
}

export async function acceptCoupleInvite(invite_code: string): Promise<{ couple_id: string }> {
  const r = await apiClient.post<{ couple_id: string }>('/couples/accept', { invite_code });
  return r.data!;
}

export async function updateCoupleSettings(params: {
  nickname?: string;
  relationship_type?: string;
  anniversary?: string;
}): Promise<void> {
  await apiClient.put('/couples/settings', params);
}

export async function endRelationship(): Promise<void> {
  await apiClient.post('/couples/end', {});
}

// =============================================================================
// Dashboard
// =============================================================================

export async function getDashboard(): Promise<Dashboard> {
  const r = await apiClient.get<Dashboard>('/couples/dashboard');
  return r.data!;
}

// =============================================================================
// Activities
// =============================================================================

export async function getActivities(params?: {
  category?: string;
  difficulty?: string;
  daily?: boolean;
  weekly?: boolean;
}): Promise<{ activities: Activity[] }> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.difficulty) query.set('difficulty', params.difficulty);
  if (params?.daily) query.set('daily', 'true');
  if (params?.weekly) query.set('weekly', 'true');
  const r = await apiClient.get<{ activities: Activity[] }>(`/activities?${query}`);
  return r.data ?? { activities: [] };
}

export async function getDailyActivity(): Promise<{ daily_activity: Activity | null }> {
  const r = await apiClient.get<{ daily_activity: Activity | null }>('/activities/daily');
  return r.data ?? { daily_activity: null };
}

export async function getActivity(activityId: string): Promise<{ activity: Activity }> {
  const r = await apiClient.get<{ activity: Activity }>(`/activities/${activityId}`);
  return r.data!;
}

export async function startActivity(activityId: string): Promise<{ completion_id: string }> {
  const r = await apiClient.post<{ completion_id: string }>(`/activities/${activityId}/start`, {});
  return r.data!;
}

export async function submitActivity(
  activityId: string,
  params: { response?: any; rating?: number }
): Promise<{
  success: boolean;
  completed?: boolean;
  waiting_for_partner?: boolean;
  xp_earned?: number;
  new_level?: number;
  new_streak?: number;
}> {
  const r = await apiClient.post<{
    success: boolean;
    completed?: boolean;
    waiting_for_partner?: boolean;
    xp_earned?: number;
    new_level?: number;
    new_streak?: number;
  }>(`/activities/${activityId}/submit`, params);
  return r.data ?? { success: false };
}

export async function getActivityHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ history: RecentActivity[] }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const r = await apiClient.get<{ history: RecentActivity[] }>(`/activities/history/all?${query}`);
  return r.data ?? { history: [] };
}

// =============================================================================
// Quizzes
// =============================================================================

export async function getQuizzes(category?: string): Promise<{ quizzes: Quiz[] }> {
  const query = category ? `?category=${category}` : '';
  const r = await apiClient.get<{ quizzes: Quiz[] }>(`/quizzes${query}`);
  return r.data ?? { quizzes: [] };
}

export async function getQuizCategories(): Promise<{
  categories: { id: string; name: string; description: string; icon: string }[];
}> {
  const r = await apiClient.get<{
    categories: { id: string; name: string; description: string; icon: string }[];
  }>('/quizzes/categories');
  return r.data ?? { categories: [] };
}

export async function getQuiz(quizId: string): Promise<{
  quiz: Quiz & { questions: QuizQuestion[] };
}> {
  const r = await apiClient.get<{ quiz: Quiz & { questions: QuizQuestion[] } }>(`/quizzes/${quizId}`);
  return r.data!;
}

export async function startQuiz(quizId: string): Promise<{
  attempt_id: string;
  questions: QuizQuestion[];
  time_limit?: number;
}> {
  const r = await apiClient.post<{
    attempt_id: string;
    questions: QuizQuestion[];
    time_limit?: number;
  }>(`/quizzes/${quizId}/start`, {});
  return r.data!;
}

export async function submitQuiz(
  quizId: string,
  params: { attempt_id: string; answers: { question_id: string; answer: any }[] }
): Promise<{
  score: number;
  max_score: number;
  percentage: number;
  match_percent?: number;
  xp_earned: number;
  answers: { question_id: string; your_answer: any; is_correct: boolean }[];
}> {
  const r = await apiClient.post<{
    score: number;
    max_score: number;
    percentage: number;
    match_percent?: number;
    xp_earned: number;
    answers: { question_id: string; your_answer: any; is_correct: boolean }[];
  }>(`/quizzes/${quizId}/submit`, params);
  return r.data!;
}

export async function getQuizResults(quizId: string): Promise<{
  quiz: Quiz;
  my_result: any;
  partner_result: any;
  both_completed: boolean;
}> {
  const r = await apiClient.get<{
    quiz: Quiz;
    my_result: any;
    partner_result: any;
    both_completed: boolean;
  }>(`/quizzes/${quizId}/results`);
  return r.data!;
}

// =============================================================================
// Dates
// =============================================================================

export async function getUpcomingDates(): Promise<{ dates: DatePlan[] }> {
  const r = await apiClient.get<{ dates: DatePlan[] }>('/dates/upcoming');
  return r.data ?? { dates: [] };
}

export async function getPastDates(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ dates: DatePlan[] }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const r = await apiClient.get<{ dates: DatePlan[] }>(`/dates/past?${query}`);
  return r.data ?? { dates: [] };
}

export async function createDate(params: {
  title: string;
  description?: string;
  date_type: string;
  scheduled_at: string;
  duration?: number;
  location?: string;
  meeting_url?: string;
}): Promise<{ date_id: string }> {
  const r = await apiClient.post<{ date_id: string }>('/dates', params);
  return r.data!;
}

export async function confirmDate(dateId: string): Promise<void> {
  await apiClient.post(`/dates/${dateId}/confirm`, {});
}

export async function cancelDate(dateId: string): Promise<void> {
  await apiClient.post(`/dates/${dateId}/cancel`, {});
}

export async function completeDate(
  dateId: string,
  params: { rating?: number; notes?: string }
): Promise<{ xp_earned: number }> {
  const r = await apiClient.post<{ xp_earned: number }>(`/dates/${dateId}/complete`, params);
  return r.data ?? { xp_earned: 0 };
}

export async function getDateIdeas(type?: string): Promise<{ ideas: DateIdea[] }> {
  const query = type ? `?type=${type}` : '';
  const r = await apiClient.get<{ ideas: DateIdea[] }>(`/dates/ideas${query}`);
  return r.data ?? { ideas: [] };
}

// =============================================================================
// Achievements
// =============================================================================

export async function getAchievements(category?: string): Promise<{ achievements: Achievement[] }> {
  const query = category ? `?category=${category}` : '';
  const r = await apiClient.get<{ achievements: Achievement[] }>(`/achievements${query}`);
  return r.data ?? { achievements: [] };
}

export async function getEarnedAchievements(): Promise<{
  achievements: Achievement[];
  total_earned: number;
  total_xp: number;
}> {
  const r = await apiClient.get<{
    achievements: Achievement[];
    total_earned: number;
    total_xp: number;
  }>('/achievements/earned');
  return r.data ?? { achievements: [], total_earned: 0, total_xp: 0 };
}

export async function getLeaderboard(type?: 'xp' | 'streak'): Promise<{
  leaderboard: {
    rank: number;
    couple_id: string;
    nickname: string;
    level: number;
    xp: number;
    streak: number;
    is_current_user: boolean;
  }[];
  user_rank: number;
}> {
  const query = type ? `?type=${type}` : '';
  const r = await apiClient.get<{
    leaderboard: {
      rank: number;
      couple_id: string;
      nickname: string;
      level: number;
      xp: number;
      streak: number;
      is_current_user: boolean;
    }[];
    user_rank: number;
  }>(`/achievements/leaderboard${query}`);
  return r.data ?? { leaderboard: [], user_rank: 0 };
}

// =============================================================================
// Milestones & Memories
// =============================================================================

export async function getMilestones(): Promise<{ milestones: Milestone[] }> {
  const r = await apiClient.get<{ milestones: Milestone[] }>('/couples/milestones');
  return r.data ?? { milestones: [] };
}

export async function addMilestone(params: {
  type?: string;
  title: string;
  description?: string;
  date: string;
  photo_url?: string;
}): Promise<{ milestone_id: string }> {
  const r = await apiClient.post<{ milestone_id: string }>('/couples/milestones', params);
  return r.data!;
}

export async function getMemories(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ memories: Memory[] }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const r = await apiClient.get<{ memories: Memory[] }>(`/couples/memories?${query}`);
  return r.data ?? { memories: [] };
}

export async function addMemory(params: {
  type?: string;
  title?: string;
  content?: string;
  media_url?: string;
  location?: string;
  mood?: string;
}): Promise<{ memory_id: string }> {
  const r = await apiClient.post<{ memory_id: string }>('/couples/memories', params);
  return r.data!;
}

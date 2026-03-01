import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { DiscoverProfile, MatchWithUser, MatchesResponse } from '@/types';

interface SwipeResult {
  matched: boolean;
  match_id?: string;
}

interface DiscoverResponse {
  profiles: DiscoverProfile[];
}

interface MatchingState {
  // Discover state
  discoverProfiles: DiscoverProfile[];
  currentProfileIndex: number;
  isLoadingDiscover: boolean;
  discoverError: string | null;

  // Matches state
  matches: MatchWithUser[];
  isLoadingMatches: boolean;
  matchesError: string | null;

  // Actions
  loadDiscoverProfiles: () => Promise<void>;
  swipe: (userId: string, direction: 'like' | 'pass') => Promise<SwipeResult | null>;
  nextProfile: () => void;
  loadMatches: () => Promise<void>;
  unmatch: (matchId: string) => Promise<boolean>;
  addMatch: (match: MatchWithUser) => void;
  reset: () => void;
}

const initialState = {
  discoverProfiles: [],
  currentProfileIndex: 0,
  isLoadingDiscover: false,
  discoverError: null,
  matches: [],
  isLoadingMatches: false,
  matchesError: null,
};

/**
 * Zustand store for discovery, swipes, and matches.
 * @returns Matching state and actions for discover and swipe flows.
 * @example
 * const { loadDiscoverProfiles, swipe } = useMatchingStore();
 */
export const useMatchingStore = create<MatchingState>((set, get) => ({
  ...initialState,

  loadDiscoverProfiles: async () => {
    set({ isLoadingDiscover: true, discoverError: null });
    try {
      const response = await apiClient.get<DiscoverResponse>('/v1/discover?limit=20');
      if (response.success && response.data) {
        set({
          discoverProfiles: response.data.profiles || [],
          currentProfileIndex: 0,
          isLoadingDiscover: false,
        });
      } else {
        set({
          discoverError: response.error || 'Failed to load profiles',
          isLoadingDiscover: false,
        });
      }
    } catch (error) {
      console.error('[matchingStore] Failed to load discover profiles:', error);
      set({
        discoverError: error instanceof Error ? error.message : 'Network error',
        isLoadingDiscover: false,
      });
    }
  },

  swipe: async (userId: string, direction: 'like' | 'pass') => {
    try {
      const response = await apiClient.post<SwipeResult>('/v1/discover/swipe', {
        user_id: userId,
        direction,
      });
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('[matchingStore] Failed to swipe:', error);
      return null;
    }
  },

  nextProfile: () => {
    const { currentProfileIndex, discoverProfiles, loadDiscoverProfiles } = get();
    const nextIndex = currentProfileIndex + 1;

    // Preload more profiles when getting low
    if (nextIndex >= discoverProfiles.length - 3) {
      loadDiscoverProfiles();
    }

    set({ currentProfileIndex: nextIndex });
  },

  loadMatches: async () => {
    set({ isLoadingMatches: true, matchesError: null });
    try {
      const response = await apiClient.get<MatchesResponse>('/v1/matches');
      if (response.success && response.data) {
        set({
          matches: response.data.matches || [],
          isLoadingMatches: false,
        });
      } else {
        set({
          matchesError: response.error || 'Failed to load matches',
          isLoadingMatches: false,
        });
      }
    } catch (error) {
      console.error('[matchingStore] Failed to load matches:', error);
      set({
        matchesError: error instanceof Error ? error.message : 'Network error',
        isLoadingMatches: false,
      });
    }
  },

  unmatch: async (matchId: string) => {
    try {
      const response = await apiClient.delete(`/v1/matches/${matchId}`);
      if (response.success) {
        set((state) => ({
          matches: state.matches.filter((m) => m.id !== matchId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('[matchingStore] Failed to unmatch:', error);
      return false;
    }
  },

  addMatch: (match: MatchWithUser) => {
    set((state) => ({
      matches: [match, ...state.matches],
    }));
  },

  reset: () => set(initialState),
}));

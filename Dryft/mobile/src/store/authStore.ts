import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import authApi, { Session } from '../api/auth';
import apiClient from '../api/client';
import { setUser as setSentryUser } from '../utils/sentry';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  isLoading: boolean;
  error: string | null;
  sessions: Session[];

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, displayName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccount: (password: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  checkVerification: () => Promise<void>;
  clearError: () => void;
  fetchSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string, revokeOthers?: boolean) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

/**
 * Get the current access token from the API client.
 * Used by services that need direct token access (e.g., WebSocket connections).
 */
export const getToken = (): string | null => {
  return apiClient.accessToken;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
  user: null,
  isAuthenticated: false,
  isVerified: false,
  isLoading: true,
  error: null,
  sessions: [],

  initialize: async () => {
    const currentState = get();
    set({ isLoading: true, error: null });

    const hasValidTokens = await authApi.initialize();

    if (hasValidTokens) {
      // Try to fetch fresh user data from API
      const response = await authApi.getCurrentUser();

      if (response.success && response.data) {
        // Successfully got fresh data - update state
        const verifyResponse = await apiClient.get<{ overall_status: string }>(
          '/v1/age-gate/status'
        );
        const isVerified = verifyResponse.success &&
          verifyResponse.data?.overall_status === 'verified';

        setSentryUser({ id: response.data.id, email: response.data.email });
        set({
          user: response.data,
          isAuthenticated: true,
          isVerified,
          isLoading: false,
        });
        return;
      }

      // API call failed - check if it's an auth error or network issue
      if (response.isAuthError) {
        // Token is invalid - clear everything
        set({
          user: null,
          isAuthenticated: false,
          isVerified: false,
          isLoading: false,
        });
        return;
      }

      // Network error but we have cached user data - keep them logged in
      if (currentState.user && currentState.isAuthenticated) {
        set({ isLoading: false });
        return;
      }
    }

    // No valid tokens or no cached data - not authenticated
    set({
      user: null,
      isAuthenticated: false,
      isVerified: false,
      isLoading: false,
    });
  },

  checkVerification: async () => {
    const response = await apiClient.get<{ overall_status: string }>(
      '/v1/age-gate/status'
    );
    if (response.success && response.data) {
      set({ isVerified: response.data.overall_status === 'verified' });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    const response = await authApi.login({ email, password });

    if (response.success && response.data) {
      setSentryUser({ id: response.data.user.id, email: response.data.user.email });
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }

    set({
      error: response.error || 'Login failed',
      isLoading: false,
    });
    return false;
  },

  register: async (email: string, password: string, displayName?: string) => {
    set({ isLoading: true, error: null });

    const response = await authApi.register({
      email,
      password,
      display_name: displayName,
    });

    if (response.success && response.data) {
      setSentryUser({ id: response.data.user.id, email: response.data.user.email });
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }

    set({
      error: response.error || 'Registration failed',
      isLoading: false,
    });
    return false;
  },

  logout: async () => {
    await authApi.logout();
    setSentryUser(null);
    set({
      user: null,
      isAuthenticated: false,
      isVerified: false,
      error: null,
      sessions: [],
    });
  },

  logoutAll: async () => {
    const response = await authApi.logoutAll();
    if (response.success) {
      setSentryUser(null);
      set({
        user: null,
        isAuthenticated: false,
        isVerified: false,
        error: null,
        sessions: [],
      });
    }
  },

  deleteAccount: async (password: string, reason?: string) => {
    set({ isLoading: true, error: null });

    const response = await authApi.deleteAccount({ password, reason });

    if (response.success) {
      setSentryUser(null);
      set({
        user: null,
        isAuthenticated: false,
        isVerified: false,
        isLoading: false,
        error: null,
        sessions: [],
      });
      return { success: true };
    }

    set({
      isLoading: false,
      error: response.error || 'Failed to delete account',
    });
    return { success: false, error: response.error };
  },

  updateProfile: async (data: Partial<User>) => {
    set({ isLoading: true, error: null });

    const response = await authApi.updateProfile(data);

    if (response.success && response.data) {
      set({
        user: response.data,
        isLoading: false,
      });
      return true;
    }

    set({
      error: response.error || 'Update failed',
      isLoading: false,
    });
    return false;
  },

  clearError: () => set({ error: null }),

  fetchSessions: async () => {
    const response = await authApi.getSessions();
    if (response.success && response.data) {
      set({ sessions: response.data.sessions });
    }
  },

  revokeSession: async (sessionId: string) => {
    const response = await authApi.revokeSession(sessionId);
    if (response.success) {
      const { sessions } = get();
      set({ sessions: sessions.filter(s => s.id !== sessionId) });
      return true;
    }
    return false;
  },

  changePassword: async (currentPassword: string, newPassword: string, revokeOthers = false) => {
    set({ isLoading: true, error: null });

    const response = await authApi.changePassword({
      current_password: currentPassword,
      new_password: newPassword,
      revoke_other_sessions: revokeOthers,
    });

    if (response.success) {
      set({ isLoading: false });
      if (revokeOthers) {
        await get().fetchSessions();
      }
      return true;
    }

    set({
      error: response.error || 'Failed to change password',
      isLoading: false,
    });
    return false;
  },

  refreshUser: async () => {
    const response = await authApi.getCurrentUser();
    if (response.success && response.data) {
      set({ user: response.data });
    }
  },
    }),
    {
      name: 'dryft-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user data and verification status, not loading/error states
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isVerified: state.isVerified,
      }),
    }
  )
);

export default useAuthStore;

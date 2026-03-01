import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    displayName: string;
    verified: boolean;
  } | null;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthState['user']) => void;
  clearAuth: () => void;
}

/**
 * Zustand store for auth tokens and current user profile.
 * @returns Auth state and mutators (setTokens, setUser, clearAuth).
 * @example
 * const { token, setTokens } = useAuthStore();
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      user: null,

      setTokens: (accessToken, refreshToken) =>
        set({
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      setUser: (user) => set({ user }),

      clearAuth: () =>
        set({
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          user: null,
        }),
    }),
    {
      name: 'dryft-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
);

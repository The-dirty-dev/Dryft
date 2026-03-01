import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset the store to its initial state before each test
    const { clearAuth } = useAuthStore.getState();
    clearAuth();
  });

  describe('initial state', () => {
    it('should start with no authentication', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('setTokens', () => {
    it('should set both tokens and mark as authenticated', () => {
      const { setTokens } = useAuthStore.getState();

      setTokens('access-token-123', 'refresh-token-456');

      const state = useAuthStore.getState();
      expect(state.token).toBe('access-token-123');
      expect(state.refreshToken).toBe('refresh-token-456');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should overwrite existing tokens', () => {
      const { setTokens } = useAuthStore.getState();

      setTokens('old-access', 'old-refresh');
      setTokens('new-access', 'new-refresh');

      const state = useAuthStore.getState();
      expect(state.token).toBe('new-access');
      expect(state.refreshToken).toBe('new-refresh');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should not affect user data when setting tokens', () => {
      const { setTokens, setUser } = useAuthStore.getState();
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        verified: true,
      };

      setUser(mockUser);
      setTokens('access-123', 'refresh-456');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('setUser', () => {
    it('should set the user data', () => {
      const { setUser } = useAuthStore.getState();
      const mockUser = {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        verified: false,
      };

      setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.user?.id).toBe('user-1');
      expect(state.user?.email).toBe('alice@example.com');
      expect(state.user?.displayName).toBe('Alice');
      expect(state.user?.verified).toBe(false);
    });

    it('should allow setting user to null', () => {
      const { setUser } = useAuthStore.getState();
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        verified: true,
      };

      setUser(mockUser);
      expect(useAuthStore.getState().user).not.toBeNull();

      setUser(null);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should replace user data completely', () => {
      const { setUser } = useAuthStore.getState();

      setUser({
        id: 'user-1',
        email: 'old@example.com',
        displayName: 'Old Name',
        verified: false,
      });

      setUser({
        id: 'user-2',
        email: 'new@example.com',
        displayName: 'New Name',
        verified: true,
      });

      const state = useAuthStore.getState();
      expect(state.user?.id).toBe('user-2');
      expect(state.user?.email).toBe('new@example.com');
      expect(state.user?.displayName).toBe('New Name');
      expect(state.user?.verified).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('should clear all auth state', () => {
      const { setTokens, setUser, clearAuth } = useAuthStore.getState();

      setTokens('access-123', 'refresh-456');
      setUser({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test',
        verified: true,
      });

      // Verify state is populated
      let state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).not.toBeNull();
      expect(state.user).not.toBeNull();

      // Clear everything
      clearAuth();

      state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should be safe to call when already cleared', () => {
      const { clearAuth } = useAuthStore.getState();

      clearAuth();
      clearAuth();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('full auth lifecycle', () => {
    it('should handle login -> set user -> logout flow', () => {
      const store = useAuthStore.getState();

      // 1. Login: set tokens
      store.setTokens('access-token', 'refresh-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 2. Set user profile data
      store.setUser({
        id: 'user-42',
        email: 'bob@dryft.site',
        displayName: 'Bob',
        verified: true,
      });
      expect(useAuthStore.getState().user?.displayName).toBe('Bob');

      // 3. Logout
      useAuthStore.getState().clearAuth();
      const finalState = useAuthStore.getState();
      expect(finalState.isAuthenticated).toBe(false);
      expect(finalState.token).toBeNull();
      expect(finalState.user).toBeNull();
    });
  });

  describe('persistence config', () => {
    it('should use "dryft-auth" as the persistence key', () => {
      // The store uses persist middleware with name 'dryft-auth'
      // We can verify the store has persist functionality
      expect(useAuthStore.persist).toBeDefined();
      expect(useAuthStore.persist.getOptions().name).toBe('dryft-auth');
    });

    it('should partialize state to exclude actions', () => {
      const { setTokens, setUser } = useAuthStore.getState();

      setTokens('tok-1', 'ref-1');
      setUser({
        id: 'u1',
        email: 'e@e.com',
        displayName: 'E',
        verified: false,
      });

      const partialize = useAuthStore.persist.getOptions().partialize;
      if (partialize) {
        const state = useAuthStore.getState();
        const persisted = partialize(state);

        // Should include data fields
        expect(persisted).toHaveProperty('token');
        expect(persisted).toHaveProperty('refreshToken');
        expect(persisted).toHaveProperty('isAuthenticated');
        expect(persisted).toHaveProperty('user');

        // Should NOT include action functions
        expect(persisted).not.toHaveProperty('setTokens');
        expect(persisted).not.toHaveProperty('setUser');
        expect(persisted).not.toHaveProperty('clearAuth');
      }
    });
  });
});

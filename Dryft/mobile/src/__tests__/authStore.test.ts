import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';

jest.mock('../utils/sentry', () => ({
  setUser: jest.fn(),
}));

jest.mock('../api/client', () => {
  const mockApiClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    saveTokens: jest.fn(),
    clearTokens: jest.fn(),
    loadTokens: jest.fn(),
    getRefreshToken: jest.fn(),
    forceRefreshToken: jest.fn(),
    isAuthenticated: false,
  };

  return {
    __esModule: true,
    default: mockApiClient,
    apiClient: mockApiClient,
  };
});

const baseState = {
  user: null,
  isAuthenticated: false,
  isVerified: false,
  isLoading: true,
  error: null,
  sessions: [],
};

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState(baseState, false);
    (apiClient as { isAuthenticated: boolean }).isAuthenticated = false;
  });

  it('initializes with fresh user data and verification status', async () => {
    (apiClient.loadTokens as jest.Mock).mockResolvedValue(undefined);
    (apiClient as { isAuthenticated: boolean }).isAuthenticated = true;
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'user-1',
          email: 'user@dryft.site',
          verified: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { overall_status: 'verified' },
      });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('user-1');
    expect(state.isVerified).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('clears state when initialize receives an auth error', async () => {
    (apiClient.loadTokens as jest.Mock).mockResolvedValue(undefined);
    (apiClient as { isAuthenticated: boolean }).isAuthenticated = true;
    (apiClient.get as jest.Mock).mockResolvedValue({
      success: false,
      isAuthError: true,
      error: 'Session expired',
    });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isVerified).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('sets error on failed login attempt', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    const result = await useAuthStore.getState().login('user@dryft.site', 'badpass');

    const state = useAuthStore.getState();
    expect(result).toBe(false);
    expect(state.error).toBe('Invalid credentials');
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('logs in and sets user state on success', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        user: {
          id: 'user-3',
          email: 'login@dryft.site',
          verified: false,
          created_at: '2024-01-03T00:00:00Z',
        },
        tokens: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          expires_at: 999999,
        },
      },
    });

    const result = await useAuthStore.getState().login('login@dryft.site', 'goodpass');

    const state = useAuthStore.getState();
    expect(result).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('login@dryft.site');
    expect(state.isLoading).toBe(false);
  });

  it('registers and sets user state on success', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        user: {
          id: 'user-4',
          email: 'new@dryft.site',
          verified: false,
          created_at: '2024-01-04T00:00:00Z',
        },
        tokens: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          expires_at: 999999,
        },
      },
    });

    const result = await useAuthStore
      .getState()
      .register('new@dryft.site', 'newpass', 'New User');

    const state = useAuthStore.getState();
    expect(result).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('user-4');
    expect(state.isLoading).toBe(false);
  });

  it('updates verification status when checkVerification succeeds', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      success: true,
      data: { overall_status: 'verified' },
    });

    await useAuthStore.getState().checkVerification();

    const state = useAuthStore.getState();
    expect(state.isVerified).toBe(true);
  });

  it('updates profile data on success', async () => {
    (apiClient.put as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'user-5',
        email: 'profile@dryft.site',
        verified: true,
        created_at: '2024-01-05T00:00:00Z',
        bio: 'Updated bio',
      },
    });

    const result = await useAuthStore
      .getState()
      .updateProfile({ bio: 'Updated bio' });

    const state = useAuthStore.getState();
    expect(result).toBe(true);
    expect(state.user?.bio).toBe('Updated bio');
    expect(state.isLoading).toBe(false);
  });

  it('returns false and sets error on profile update failure', async () => {
    (apiClient.put as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Update failed',
    });

    const result = await useAuthStore.getState().updateProfile({ bio: 'Nope' });

    const state = useAuthStore.getState();
    expect(result).toBe(false);
    expect(state.error).toBe('Update failed');
    expect(state.isLoading).toBe(false);
  });

  it('logs out and clears user state', async () => {
    useAuthStore.setState(
      {
        ...baseState,
        user: {
          id: 'user-2',
          email: 'user2@dryft.site',
          verified: true,
          created_at: '2024-01-02T00:00:00Z',
        },
        isAuthenticated: true,
        isVerified: true,
        sessions: [
          {
            id: 'session-1',
            user_id: 'user-2',
            device_type: 'ios',
            device_name: 'iPhone',
            last_active_at: '2024-01-01T00:00:00Z',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
      false
    );

    (apiClient.getRefreshToken as jest.Mock).mockResolvedValue('refresh-token');
    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });
    (apiClient.clearTokens as jest.Mock).mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isVerified).toBe(false);
    expect(state.sessions).toEqual([]);
  });
});

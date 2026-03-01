import apiClient from './client';
import {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from '../types';

export interface Session {
  id: string;
  user_id: string;
  device_type: string;
  device_name: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  revoke_other_sessions?: boolean;
}

export interface DeleteAccountRequest {
  password: string;
  reason?: string;
}

export const authApi = {
  /**
   * Register a new user account.
   */
  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/v1/auth/register', data);
    if (response.success && response.data) {
      await apiClient.saveTokens(response.data.tokens);
    }
    return response;
  },

  /**
   * Log in with email and password.
   */
  async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/v1/auth/login', data);
    if (response.success && response.data) {
      await apiClient.saveTokens(response.data.tokens);
    }
    return response;
  },

  /**
   * Log out and clear tokens.
   * Notifies the server to revoke the session.
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = await apiClient.getRefreshToken();
      if (refreshToken) {
        // Notify server to revoke session
        await apiClient.post('/v1/auth/logout', { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('[Auth] Server logout failed:', error);
    } finally {
      // Always clear local tokens
      await apiClient.clearTokens();
    }
  },

  /**
   * Log out from all devices.
   */
  async logoutAll(): Promise<ApiResponse<void>> {
    const response = await apiClient.post<void>('/v1/auth/logout-all');
    if (response.success) {
      await apiClient.clearTokens();
    }
    return response;
  },

  /**
   * Get the current user's profile.
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/v1/users/me');
  },

  /**
   * Update the current user's profile.
   */
  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    return apiClient.put<User>('/v1/users/me', data);
  },

  /**
   * Check if user is authenticated and load tokens.
   */
  async initialize(): Promise<boolean> {
    await apiClient.loadTokens();
    return apiClient.isAuthenticated;
  },

  /**
   * Get all active sessions for the current user.
   */
  async getSessions(): Promise<ApiResponse<{ sessions: Session[]; count: number }>> {
    return apiClient.get<{ sessions: Session[]; count: number }>('/v1/auth/sessions');
  },

  /**
   * Revoke a specific session (log out from one device).
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/v1/auth/sessions/${sessionId}`);
  },

  /**
   * Change the user's password.
   */
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/v1/auth/change-password', data);
  },

  /**
   * Refresh the access token.
   * Usually handled automatically by the API client, but can be called manually.
   */
  async refreshToken(): Promise<boolean> {
    return apiClient.forceRefreshToken();
  },

  /**
   * Permanently delete the user's account.
   * Requires password confirmation for security.
   */
  async deleteAccount(data: DeleteAccountRequest): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.delete<{ message: string }>('/v1/users/me', data);
    if (response.success) {
      await apiClient.clearTokens();
    }
    return response;
  },
};

export default authApi;

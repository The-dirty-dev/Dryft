import * as SecureStore from 'expo-secure-store';
import {
  ApiResponse,
  AuthTokens,
  ERROR_CODES,
  ERROR_MESSAGES,
  getErrorCodeForStatus,
} from '../types';
import { getErrorI18nKey, ErrorCode } from '../../../shared/types/src/errors';
import i18n from '../i18n';
import {
  withRetry,
  classifyError,
  ErrorType,
  useNetworkStore,
  reportError,
} from '../utils/errorHandler';
import { API_BASE_URL } from '../config';

/**
 * Get localized error message for an error code.
 * Falls back to English if translation is missing.
 */
function getLocalizedErrorMessage(errorCode: ErrorCode): string {
  const i18nKey = getErrorI18nKey(errorCode);
  const translated = i18n.t(i18nKey);
  // If translation returns the key itself, fall back to English
  if (translated === i18nKey) {
    return ERROR_MESSAGES[errorCode];
  }
  return translated;
}

const TOKEN_KEY = 'dryft_auth_tokens';
const REQUEST_TIMEOUT = 30000; // 30 seconds

class ApiClient {
  private static instance: ApiClient;
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  // ==========================================================================
  // Token Management
  // ==========================================================================

  async loadTokens(): Promise<void> {
    try {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        this.tokens = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ApiClient] Failed to load tokens:', error);
    }
  }

  async saveTokens(tokens: AuthTokens): Promise<void> {
    this.tokens = tokens;
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error('[ApiClient] Failed to save tokens:', error);
    }
  }

  async clearTokens(): Promise<void> {
    this.tokens = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('[ApiClient] Failed to clear tokens:', error);
    }
  }

  get isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  get accessToken(): string | null {
    return this.tokens?.access_token ?? null;
  }

  async getRefreshToken(): Promise<string | null> {
    if (this.tokens?.refresh_token) {
      return this.tokens.refresh_token;
    }
    await this.loadTokens();
    return this.tokens?.refresh_token ?? null;
  }

  /**
   * Force a token refresh. Used when manually triggering a refresh.
   */
  async forceRefreshToken(): Promise<boolean> {
    return this.refreshToken();
  }

  /**
   * Check if the current token is expired or about to expire.
   */
  isTokenExpired(): boolean {
    if (!this.tokens?.expires_at) {
      return true;
    }
    // Consider expired if less than 60 seconds remaining
    const expiresAt = this.tokens.expires_at * 1000;
    return Date.now() >= expiresAt - 60000;
  }

  // ==========================================================================
  // Request Methods
  // ==========================================================================

  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'GET');
  }

  async post<T = any>(endpoint: string, body?: object): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'POST', body);
  }

  async put<T = any>(endpoint: string, body?: object): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'PUT', body);
  }

  async patch<T = any>(endpoint: string, body?: object): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'PATCH', body);
  }

  async delete<T = any>(endpoint: string, body?: object): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'DELETE', body);
  }

  private async request<T = any>(
    endpoint: string,
    method: string,
    body?: object,
    retry = true
  ): Promise<ApiResponse<T>> {
    // Check network state first
    const networkState = useNetworkStore.getState();
    if (!networkState.isConnected) {
      return {
        success: false,
        error: getLocalizedErrorMessage(ERROR_CODES.NETWORK),
        errorCode: ERROR_CODES.NETWORK,
        isOffline: true,
      };
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.tokens?.access_token) {
      headers['Authorization'] = `Bearer ${this.tokens.access_token}`;
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 - try to refresh token
      if (response.status === 401 && retry && this.tokens?.refresh_token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request<T>(endpoint, method, body, false);
        }
        // Refresh failed, clear tokens
        await this.clearTokens();
        return {
          success: false,
          error: getLocalizedErrorMessage(ERROR_CODES.AUTH),
          errorCode: ERROR_CODES.AUTH,
          status: response.status,
          isAuthError: true,
        };
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        return {
          success: false,
          error: getLocalizedErrorMessage(ERROR_CODES.RATE_LIMITED),
          errorCode: ERROR_CODES.RATE_LIMITED,
          status: response.status,
          retryAfter: retryAfter ? parseInt(retryAfter, 10) : 60,
        };
      }

      const text = await response.text();
      let data: T | undefined;
      let error: string | undefined;

      if (text) {
        try {
          const json = JSON.parse(text);
          if (response.ok) {
            data = json as T;
          } else {
            error = json.error || json.message || 'Request failed';
          }
        } catch {
          error = text;
        }
      }

      if (!response.ok) {
        const errorCode = getErrorCodeForStatus(response.status);
        const fallbackMessage = getLocalizedErrorMessage(errorCode);
        const resolvedError =
          errorCode === ERROR_CODES.VALIDATION && error
            ? error
            : error || fallbackMessage;

        return {
          success: false,
          data,
          error: resolvedError,
          errorCode,
          status: response.status,
        };
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      const appError = classifyError(error);

      // Report non-network errors
      if (appError.type !== ErrorType.NETWORK) {
        reportError(appError, { endpoint, method });
      }

      console.error(`[ApiClient] ${method} ${endpoint} failed:`, appError.message);

      return {
        success: false,
        error: appError.message,
        errorCode: appError.type,
        isOffline: appError.type === ErrorType.NETWORK,
        isTimeout: appError.type === ErrorType.TIMEOUT,
      };
    }
  }

  /**
   * Make a request with automatic retry.
   */
  async requestWithRetry<T = any>(
    endpoint: string,
    method: string,
    body?: object
  ): Promise<ApiResponse<T>> {
    return withRetry(() => this.requestRaw<T>(endpoint, method, body));
  }

  /**
   * Raw request that throws on failure (for retry wrapper).
   */
  private async requestRaw<T = any>(
    endpoint: string,
    method: string,
    body?: object
  ): Promise<ApiResponse<T>> {
    const result = await this.request<T>(endpoint, method, body);
    if (!result.success) {
      throw new Error(result.error || 'Request failed');
    }
    return result;
  }

  private async refreshToken(): Promise<boolean> {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshToken();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    return result;
  }

  private async doRefreshToken(): Promise<boolean> {
    if (!this.tokens?.refresh_token) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.tokens.refresh_token }),
      });

      if (response.ok) {
        const data = await response.json();
        await this.saveTokens(data.tokens);
        return true;
      }
    } catch (error) {
      console.error('[ApiClient] Token refresh failed:', error);
    }

    // Refresh failed - clear tokens
    await this.clearTokens();
    return false;
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const apiClient = ApiClient.getInstance();

// Alias for stores/tests that import { api }
export const api = apiClient;

export default apiClient;

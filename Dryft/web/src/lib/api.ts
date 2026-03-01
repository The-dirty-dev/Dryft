import {
  AuthResponse,
  AuthTokens,
  ConversationsResponse,
  ErrorCode,
  ERROR_CODES,
  ERROR_MESSAGES,
  ItemType,
  LoginRequest,
  MatchesResponse,
  Message,
  NotificationsResponse,
  PurchaseResult,
  RegisterRequest,
  SettingsPayload,
  SettingsResponse,
  StoreItemsResponse,
  User,
  UserProfile,
  getErrorCodeForStatus,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'dryft_tokens';
export const API_ERROR_EVENT = 'dryft:api-error';

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ErrorCode;
  status?: number;
}

export interface ApiErrorEventDetail {
  code: ErrorCode;
  message: string;
  status?: number;
  endpoint: string;
  method: string;
}

const TOAST_ERROR_CODES = new Set<ErrorCode>([
  ERROR_CODES.NETWORK,
  ERROR_CODES.SERVER,
  ERROR_CODES.TIMEOUT,
  ERROR_CODES.RATE_LIMITED,
  ERROR_CODES.UNKNOWN,
]);

const emitApiError = (detail: ApiErrorEventDetail) => {
  if (typeof window === 'undefined') return;
  if (!TOAST_ERROR_CODES.has(detail.code)) return;
  window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail }));
};

class ApiClient {
  private static instance: ApiClient;
  private tokens: AuthTokens | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.loadTokens();
    }
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private loadTokens(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (!stored) {
        this.tokens = null;
        return;
      }

      try {
        this.tokens = JSON.parse(stored);
      } catch {
        console.warn('[ApiClient] Clearing invalid stored tokens');
        localStorage.removeItem(TOKEN_KEY);
        this.tokens = null;
      }
    } catch (error) {
      console.error('[ApiClient] Failed to load tokens:', error);
      this.tokens = null;
    }
  }

  saveTokens(tokens: AuthTokens): void {
    this.tokens = tokens;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    }
  }

  clearTokens(): void {
    this.tokens = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  get isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  get accessToken(): string | null {
    return this.tokens?.access_token ?? null;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  async get<T>(endpoint: string): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, 'GET');
  }

  async post<T>(endpoint: string, body?: object): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, 'POST', body);
  }

  async put<T>(endpoint: string, body?: object): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, 'PUT', body);
  }

  async patch<T>(endpoint: string, body?: object): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, 'PATCH', body);
  }

  async delete<T>(endpoint: string): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, 'DELETE');
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {};

    if (this.tokens?.access_token) {
      headers['Authorization'] = `Bearer ${this.tokens.access_token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const text = await response.text();
      let data: T | undefined;
      let error: string | undefined;

      if (text) {
        try {
          const json = JSON.parse(text);
          if (response.ok) {
            data = json as T;
          } else {
            error = json.error || 'Upload failed';
          }
        } catch {
          error = text;
        }
      }

      if (!response.ok) {
        const errorCode = getErrorCodeForStatus(response.status);
        const fallbackMessage = ERROR_MESSAGES[errorCode];
        const resolvedError =
          errorCode === ERROR_CODES.VALIDATION && error ? error : error || fallbackMessage;

        emitApiError({
          code: errorCode,
          message: resolvedError,
          status: response.status,
          endpoint,
          method: 'UPLOAD',
        });

        return { success: false, data, error: resolvedError, errorCode, status: response.status };
      }

      return { success: true, data, status: response.status };
    } catch (error) {
      console.error(`[ApiClient] Upload ${endpoint} failed:`, error);
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const errorCode = isAbort ? ERROR_CODES.TIMEOUT : ERROR_CODES.NETWORK;
      const message = isAbort ? ERROR_MESSAGES.timeout : ERROR_MESSAGES.network;

      emitApiError({
        code: errorCode,
        message,
        endpoint,
        method: 'UPLOAD',
      });

      return {
        success: false,
        error: message,
        errorCode,
      };
    }
  }

  private async request<T>(
    endpoint: string,
    method: string,
    body?: object,
    retry = true
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.tokens?.access_token) {
      headers['Authorization'] = `Bearer ${this.tokens.access_token}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401 && retry && this.tokens?.refresh_token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request<T>(endpoint, method, body, false);
        }
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
            error = json.error || 'Request failed';
          }
        } catch {
          error = text;
        }
      }

      if (!response.ok) {
        const errorCode = getErrorCodeForStatus(response.status);
        const fallbackMessage = ERROR_MESSAGES[errorCode];
        const resolvedError =
          errorCode === ERROR_CODES.VALIDATION && error ? error : error || fallbackMessage;

        emitApiError({
          code: errorCode,
          message: resolvedError,
          status: response.status,
          endpoint,
          method,
        });

        return { success: false, data, error: resolvedError, errorCode, status: response.status };
      }

      return { success: true, data, status: response.status };
    } catch (error) {
      console.error(`[ApiClient] ${method} ${endpoint} failed:`, error);
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const errorCode = isAbort ? ERROR_CODES.TIMEOUT : ERROR_CODES.NETWORK;
      const message = isAbort ? ERROR_MESSAGES.timeout : ERROR_MESSAGES.network;

      emitApiError({
        code: errorCode,
        message,
        endpoint,
        method,
      });

      return {
        success: false,
        error: message,
        errorCode,
      };
    }
  }

  private async refreshToken(): Promise<boolean> {
    if (!this.tokens?.refresh_token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.tokens.refresh_token }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokens(data.tokens);
        return true;
      }
    } catch (error) {
      console.error('[ApiClient] Token refresh failed:', error);
    }

    this.clearTokens();
    return false;
  }
}

export const apiClient = ApiClient.getInstance();

export const api = {
  async login(data: LoginRequest): Promise<ApiResult<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/v1/auth/login', data);
    if (response.success && response.data) {
      apiClient.saveTokens(response.data.tokens);
    }
    return response;
  },

  async register(data: RegisterRequest): Promise<ApiResult<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/v1/auth/register', data);
    if (response.success && response.data) {
      apiClient.saveTokens(response.data.tokens);
    }
    return response;
  },

  async getProfile(): Promise<ApiResult<UserProfile>> {
    return apiClient.get<UserProfile>('/v1/profile');
  },

  async updateProfile(data: Partial<UserProfile>): Promise<ApiResult<UserProfile>> {
    return apiClient.patch<UserProfile>('/v1/profile', data);
  },

  async getMatches(): Promise<ApiResult<MatchesResponse>> {
    return apiClient.get<MatchesResponse>('/v1/matches');
  },

  async getConversations(): Promise<ApiResult<ConversationsResponse>> {
    return apiClient.get<ConversationsResponse>('/v1/conversations');
  },

  async sendMessage(conversationId: string, content: string): Promise<ApiResult<Message>> {
    return apiClient.post<Message>(`/v1/conversations/${conversationId}/messages`, { content });
  },

  async getStoreItems(options: {
    limit?: number;
    offset?: number;
    type?: ItemType;
    search?: string;
    creatorId?: string;
    categoryId?: string;
    featured?: boolean;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<ApiResult<StoreItemsResponse>> {
    const params = new URLSearchParams();

    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.type) params.append('type', options.type);
    if (options.search) params.append('search', options.search);
    if (options.creatorId) params.append('creator_id', options.creatorId);
    if (options.categoryId) params.append('category_id', options.categoryId);
    if (options.featured) params.append('featured', 'true');
    if (options.sortBy) params.append('sort_by', options.sortBy);
    if (options.sortOrder) params.append('sort_order', options.sortOrder);

    const query = params.toString();
    const endpoint = query ? `/v1/store/items?${query}` : '/v1/store/items';
    return apiClient.get<StoreItemsResponse>(endpoint);
  },

  async purchaseItem(itemId: string): Promise<ApiResult<PurchaseResult>> {
    return apiClient.post<PurchaseResult>('/v1/store/purchase', { item_id: itemId });
  },

  async getNotifications(): Promise<ApiResult<NotificationsResponse>> {
    return apiClient.get<NotificationsResponse>('/v1/notifications');
  },

  async markNotificationRead(notificationId: string): Promise<ApiResult<void>> {
    return apiClient.post(`/v1/notifications/${notificationId}/read`);
  },

  async getSettings(): Promise<ApiResult<SettingsResponse>> {
    return apiClient.get<SettingsResponse>('/v1/settings');
  },

  async updateSettings(settings: SettingsPayload): Promise<ApiResult<SettingsResponse>> {
    return apiClient.put<SettingsResponse>('/v1/settings', settings);
  },

  async getCurrentUser(): Promise<ApiResult<User>> {
    return apiClient.get<User>('/v1/users/me');
  },
};

export default apiClient;

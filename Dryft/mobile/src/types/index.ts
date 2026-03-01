import i18n, { getCurrentLanguage } from '../i18n';
import type { ItemCategory, ItemType, PurchaseStatus } from '../../../shared/types/src';
import type { ErrorCode } from '../../../shared/types/src/errors';

// =============================================================================
// Re-export Error Utilities from Shared Types
// =============================================================================

export {
  ERROR_CODES,
  ERROR_MESSAGES,
  isRetryableError,
  getErrorCodeForStatus,
} from '../../../shared/types/src/errors';
export type { ErrorCode } from '../../../shared/types/src/errors';

// =============================================================================
// Shared Types
// =============================================================================

export type {
  AuthResponse,
  AuthTokens,
  Call,
  CallStatus,
  CallType,
  Conversation,
  ConversationsResponse,
  Creator,
  DiscoverProfile,
  DiscoverResponse,
  InventoryItem,
  InventoryResponse,
  ItemCategory,
  ItemStatus,
  ItemType,
  LoginRequest,
  MatchWithUser as Match,
  MatchesResponse,
  Message,
  MessageType,
  MessagesResponse,
  Notification,
  NotificationType,
  NotificationsResponse,
  PurchaseResult,
  PurchaseStatus,
  RegisterRequest,
  StoreItem,
  StoreItemsResponse,
  SwipeResult,
  User,
  UserPreferences,
  UserProfile,
  UserPublicProfile,
  EarningsSummary,
} from '../../../shared/types/src';

// =============================================================================
// Marketplace Types (Mobile-Specific)
// =============================================================================

export interface CategoriesResponse {
  categories: ItemCategory[];
}

export interface Purchase {
  id: string;
  buyer_id: string;
  item_id: string;
  creator_id: string;
  amount: number;
  currency: string;
  status: PurchaseStatus;
  created_at: string;
}

export interface PurchaseHistoryResponse {
  purchases: Purchase[];
  limit: number;
  offset: number;
}

// =============================================================================
// API Types
// =============================================================================

export interface ApiError {
  error: string;
  code?: ErrorCode;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ErrorCode;
  status?: number;
  isOffline?: boolean;
  isAuthError?: boolean;
  isTimeout?: boolean;
  retryAfter?: number;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface ItemFilter {
  type?: ItemType;
  category_id?: string;
  creator_id?: string;
  min_price?: number;
  max_price?: number;
  tags?: string[];
  search?: string;
  featured?: boolean;
  sort_by?: 'price' | 'rating' | 'popular' | 'newest';
  sort_order?: 'asc' | 'desc';
}

// =============================================================================
// Helpers
// =============================================================================

export const formatPrice = (
  cents: number,
  currency = 'usd',
  locale?: string
): string => {
  if (cents === 0) {
    const freeLabel = i18n.t('store.free');
    return typeof freeLabel === 'string' ? freeLabel : 'Free';
  }

  const dollars = cents / 100;
  const resolvedLocale = locale || getCurrentLanguage() || 'en';
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(dollars);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(dollars);
  }
};

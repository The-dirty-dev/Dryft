import apiClient from './client';
import {
  ApiResponse,
  CategoriesResponse,
  Creator,
  EarningsSummary,
  InventoryItem,
  InventoryResponse,
  ItemFilter,
  ItemType,
  PurchaseHistoryResponse,
  PurchaseResult,
  StoreItem,
  StoreItemsResponse,
} from '../types';

const normalizeStoreItem = (item: any): StoreItem => ({
  ...item,
  item_type: item.item_type ?? item.type,
});

const normalizeStoreItemsResponse = (response: ApiResponse<StoreItemsResponse>): ApiResponse<StoreItemsResponse> => {
  if (!response.success || !response.data) return response;
  return {
    ...response,
    data: {
      ...response.data,
      items: (response.data.items || []).map(normalizeStoreItem),
    },
  };
};

const normalizeInventoryItem = (item: any): InventoryItem => ({
  ...item,
  item: item.item ? normalizeStoreItem(item.item) : item.item,
});

const normalizeInventoryResponse = (
  response: ApiResponse<InventoryResponse>
): ApiResponse<InventoryResponse> => {
  if (!response.success || !response.data) return response;
  return {
    ...response,
    data: {
      ...response.data,
      items: (response.data.items || []).map(normalizeInventoryItem),
    },
  };
};

const normalizeCreator = (creator: any): Creator => ({
  ...creator,
  display_name: creator.display_name ?? creator.store_name ?? 'Creator',
  store_name: creator.store_name ?? creator.display_name,
  bio: creator.bio ?? creator.description,
  avatar_url: creator.avatar_url ?? creator.logo_url,
  average_rating: creator.average_rating ?? creator.rating ?? 0,
});

const normalizeCreatorResponse = (response: ApiResponse<Creator>): ApiResponse<Creator> => {
  if (!response.success || !response.data) return response;
  return {
    ...response,
    data: normalizeCreator(response.data),
  };
};

const normalizeCreatorsList = (
  response: ApiResponse<{ creators: Creator[] }>
): ApiResponse<{ creators: Creator[] }> => {
  if (!response.success || !response.data) return response;
  return {
    ...response,
    data: {
      ...response.data,
      creators: (response.data.creators || []).map(normalizeCreator),
    },
  };
};

export const marketplaceApi = {
  // ==========================================================================
  // Store
  // ==========================================================================

  /**
   * Get store items with optional filters.
   */
  async getItems(
    filter: ItemFilter = {},
    limit = 20,
    offset = 0
  ): Promise<ApiResponse<StoreItemsResponse>> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    if (filter.type) params.append('type', filter.type);
    if (filter.category_id) params.append('category_id', filter.category_id);
    if (filter.creator_id) params.append('creator_id', filter.creator_id);
    if (filter.min_price !== undefined) params.append('min_price', filter.min_price.toString());
    if (filter.max_price !== undefined) params.append('max_price', filter.max_price.toString());
    if (filter.search) params.append('search', filter.search);
    if (filter.featured) params.append('featured', 'true');
    if (filter.sort_by) params.append('sort_by', filter.sort_by);
    if (filter.sort_order) params.append('sort_order', filter.sort_order);

    const response = await apiClient.get<StoreItemsResponse>(`/v1/store/items?${params}`);
    return normalizeStoreItemsResponse(response);
  },

  /**
   * Get a single item by ID.
   */
  async getItem(itemId: string): Promise<ApiResponse<StoreItem>> {
    const response = await apiClient.get<StoreItem>(`/v1/store/items/${itemId}`);
    if (!response.success || !response.data) return response;
    return { ...response, data: normalizeStoreItem(response.data) };
  },

  /**
   * Get featured items.
   */
  async getFeaturedItems(limit = 10): Promise<ApiResponse<StoreItemsResponse>> {
    const response = await apiClient.get<StoreItemsResponse>(`/v1/store/featured?limit=${limit}`);
    return normalizeStoreItemsResponse(response);
  },

  /**
   * Get popular items.
   */
  async getPopularItems(limit = 10): Promise<ApiResponse<StoreItemsResponse>> {
    const response = await apiClient.get<StoreItemsResponse>(`/v1/store/popular?limit=${limit}`);
    return normalizeStoreItemsResponse(response);
  },

  /**
   * Get all categories.
   */
  async getCategories(): Promise<ApiResponse<CategoriesResponse>> {
    return apiClient.get<CategoriesResponse>('/v1/store/categories');
  },

  /**
   * Get items by category slug.
   */
  async getItemsByCategory(
    slug: string,
    limit = 20,
    offset = 0
  ): Promise<ApiResponse<StoreItemsResponse>> {
    const response = await apiClient.get<StoreItemsResponse>(
      `/v1/store/categories/${slug}/items?limit=${limit}&offset=${offset}`
    );
    return normalizeStoreItemsResponse(response);
  },

  /**
   * Search for items.
   */
  async searchItems(
    query: string,
    limit = 20,
    offset = 0
  ): Promise<ApiResponse<StoreItemsResponse>> {
    const encoded = encodeURIComponent(query);
    const response = await apiClient.get<StoreItemsResponse>(
      `/v1/store/search?q=${encoded}&limit=${limit}&offset=${offset}`
    );
    return normalizeStoreItemsResponse(response);
  },

  // ==========================================================================
  // Purchases
  // ==========================================================================

  /**
   * Initiate a purchase for an item.
   */
  async purchase(itemId: string): Promise<ApiResponse<PurchaseResult>> {
    return apiClient.post<PurchaseResult>('/v1/store/purchase', { item_id: itemId });
  },

  /**
   * Get purchase history.
   */
  async getPurchaseHistory(
    limit = 20,
    offset = 0
  ): Promise<ApiResponse<PurchaseHistoryResponse>> {
    return apiClient.get<PurchaseHistoryResponse>(
      `/v1/store/purchases?limit=${limit}&offset=${offset}`
    );
  },

  // ==========================================================================
  // Inventory
  // ==========================================================================

  /**
   * Get user's inventory.
   */
  async getInventory(
    type?: ItemType,
    limit = 50,
    offset = 0
  ): Promise<ApiResponse<InventoryResponse>> {
    const typeParam = type ? `&type=${type}` : '';
    const response = await apiClient.get<InventoryResponse>(
      `/v1/inventory?limit=${limit}&offset=${offset}${typeParam}`
    );
    return normalizeInventoryResponse(response);
  },

  /**
   * Get equipped items.
   */
  async getEquippedItems(): Promise<ApiResponse<{ items: InventoryItem[] }>> {
    const response = await apiClient.get<{ items: InventoryItem[] }>('/v1/inventory/equipped');
    if (!response.success || !response.data) return response;
    return {
      ...response,
      data: {
        ...response.data,
        items: (response.data.items || []).map(normalizeInventoryItem),
      },
    };
  },

  /**
   * Equip an item.
   */
  async equipItem(itemId: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/inventory/equip', { item_id: itemId });
  },

  /**
   * Unequip an item.
   */
  async unequipItem(itemId: string): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/inventory/unequip', { item_id: itemId });
  },

  // ==========================================================================
  // Creators
  // ==========================================================================

  /**
   * Get featured creators.
   */
  async getFeaturedCreators(limit = 10): Promise<ApiResponse<{ creators: Creator[] }>> {
    const response = await apiClient.get<{ creators: Creator[] }>(
      `/v1/creators/featured?limit=${limit}`
    );
    return normalizeCreatorsList(response);
  },

  /**
   * Get a creator by ID.
   */
  async getCreator(creatorId: string): Promise<ApiResponse<Creator>> {
    const response = await apiClient.get<Creator>(`/v1/creators/${creatorId}`);
    return normalizeCreatorResponse(response);
  },

  /**
   * Get items from a creator.
   */
  async getCreatorItems(
    creatorId: string,
    limit = 20,
    offset = 0
  ): Promise<ApiResponse<StoreItemsResponse>> {
    const response = await apiClient.get<StoreItemsResponse>(
      `/v1/creators/${creatorId}/items?limit=${limit}&offset=${offset}`
    );
    return normalizeStoreItemsResponse(response);
  },

  /**
   * Get current user's creator account.
   */
  async getMyCreatorAccount(): Promise<ApiResponse<Creator>> {
    const response = await apiClient.get<Creator>('/v1/creators/me');
    return normalizeCreatorResponse(response);
  },

  /**
   * Become a creator.
   */
  async becomeCreator(
    storeName: string,
    description?: string
  ): Promise<ApiResponse<Creator>> {
    const response = await apiClient.post<Creator>('/v1/creators', {
      store_name: storeName,
      description,
    });
    return normalizeCreatorResponse(response);
  },

  /**
   * Get Stripe onboarding link.
   */
  async getOnboardingLink(
    returnUrl: string,
    refreshUrl: string
  ): Promise<ApiResponse<{ url: string }>> {
    return apiClient.post<{ url: string }>('/v1/creators/onboarding-link', {
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
  },

  /**
   * Get creator earnings.
   */
  async getMyEarnings(): Promise<ApiResponse<EarningsSummary>> {
    return apiClient.get<EarningsSummary>('/v1/creators/earnings');
  },
};

export default marketplaceApi;

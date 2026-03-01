import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { api } from '@/lib/api';
import {
  StoreItem,
  StoreItemsResponse,
  InventoryItem,
  InventoryResponse,
  ItemType,
  PurchaseResult,
} from '@/types';

interface MarketplaceState {
  // Store browsing
  storeItems: StoreItem[];
  isLoadingStore: boolean;
  storeError: string | null;
  storeTotal: number;
  storeOffset: number;

  // Featured/Popular
  featuredItems: StoreItem[];
  popularItems: StoreItem[];

  // Current item detail
  currentItem: StoreItem | null;
  isLoadingItem: boolean;

  // Inventory
  inventory: InventoryItem[];
  isLoadingInventory: boolean;
  inventoryError: string | null;

  // Purchase state
  isPurchasing: boolean;
  purchaseError: string | null;

  // Search/filter state
  searchQuery: string;
  selectedType: ItemType | null;
  selectedCategoryId: string | null;

  // Actions
  loadStoreItems: (options?: {
    limit?: number;
    offset?: number;
    type?: ItemType;
    search?: string;
    categoryId?: string;
    featured?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }) => Promise<void>;
  loadMoreItems: () => Promise<void>;
  loadFeaturedItems: () => Promise<void>;
  loadPopularItems: () => Promise<void>;
  loadItem: (itemId: string) => Promise<void>;
  loadInventory: () => Promise<void>;
  purchaseItem: (itemId: string) => Promise<PurchaseResult | null>;
  equipItem: (inventoryItemId: string) => Promise<boolean>;
  unequipItem: (inventoryItemId: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  setSelectedType: (type: ItemType | null) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  reset: () => void;
}

const initialState = {
  storeItems: [],
  isLoadingStore: false,
  storeError: null,
  storeTotal: 0,
  storeOffset: 0,
  featuredItems: [],
  popularItems: [],
  currentItem: null,
  isLoadingItem: false,
  inventory: [],
  isLoadingInventory: false,
  inventoryError: null,
  isPurchasing: false,
  purchaseError: null,
  searchQuery: '',
  selectedType: null,
  selectedCategoryId: null,
};

/**
 * Zustand store for marketplace browsing, inventory, and purchases.
 * @returns Store state with actions to load items and purchase.
 * @example
 * const { loadStoreItems } = useMarketplaceStore();
 */
export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  ...initialState,

  loadStoreItems: async (options = {}) => {
    set({ isLoadingStore: true, storeError: null });
    try {
      const response = await api.getStoreItems({
        limit: options.limit || 20,
        offset: options.offset || 0,
        type: options.type || get().selectedType || undefined,
        search: options.search || get().searchQuery || undefined,
        categoryId: options.categoryId || get().selectedCategoryId || undefined,
        featured: options.featured,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
      });

      if (response.success && response.data) {
        set({
          storeItems: options.offset ? [...get().storeItems, ...response.data.items] : response.data.items,
          storeTotal: response.data.total,
          storeOffset: (options.offset || 0) + response.data.items.length,
          isLoadingStore: false,
        });
      } else {
        set({
          storeError: response.error || 'Failed to load store items',
          isLoadingStore: false,
        });
      }
    } catch (error) {
      console.error('[marketplaceStore] Failed to load store items:', error);
      set({
        storeError: error instanceof Error ? error.message : 'Network error',
        isLoadingStore: false,
      });
    }
  },

  loadMoreItems: async () => {
    const { storeOffset, storeTotal, isLoadingStore } = get();
    if (isLoadingStore || storeOffset >= storeTotal) return;
    await get().loadStoreItems({ offset: storeOffset });
  },

  loadFeaturedItems: async () => {
    try {
      const response = await apiClient.get<StoreItemsResponse>('/v1/store/featured');
      if (response.success && response.data) {
        set({ featuredItems: response.data.items || [] });
      }
    } catch (error) {
      console.error('[marketplaceStore] Failed to load featured items:', error);
    }
  },

  loadPopularItems: async () => {
    try {
      const response = await apiClient.get<StoreItemsResponse>('/v1/store/popular');
      if (response.success && response.data) {
        set({ popularItems: response.data.items || [] });
      }
    } catch (error) {
      console.error('[marketplaceStore] Failed to load popular items:', error);
    }
  },

  loadItem: async (itemId: string) => {
    set({ isLoadingItem: true, currentItem: null });
    try {
      const response = await apiClient.get<StoreItem>(`/v1/store/items/${itemId}`);
      if (response.success && response.data) {
        set({ currentItem: response.data, isLoadingItem: false });
      } else {
        set({ isLoadingItem: false });
      }
    } catch (error) {
      console.error('[marketplaceStore] Failed to load item:', error);
      set({ isLoadingItem: false });
    }
  },

  loadInventory: async () => {
    set({ isLoadingInventory: true, inventoryError: null });
    try {
      const response = await apiClient.get<InventoryResponse>('/v1/inventory');
      if (response.success && response.data) {
        set({
          inventory: response.data.items || [],
          isLoadingInventory: false,
        });
      } else {
        set({
          inventoryError: response.error || 'Failed to load inventory',
          isLoadingInventory: false,
        });
      }
    } catch (error) {
      console.error('[marketplaceStore] Failed to load inventory:', error);
      set({
        inventoryError: error instanceof Error ? error.message : 'Network error',
        isLoadingInventory: false,
      });
    }
  },

  purchaseItem: async (itemId: string) => {
    set({ isPurchasing: true, purchaseError: null });
    try {
      const response = await api.purchaseItem(itemId);
      if (response.success && response.data) {
        // Reload inventory to include new item
        get().loadInventory();
        // Update store item to show as owned
        set((state) => ({
          storeItems: state.storeItems.map((item) =>
            item.id === itemId ? { ...item, is_owned: true } : item
          ),
          isPurchasing: false,
        }));
        return response.data;
      }
      set({
        purchaseError: response.error || 'Purchase failed',
        isPurchasing: false,
      });
      return null;
    } catch (error) {
      console.error('[marketplaceStore] Failed to purchase item:', error);
      set({
        purchaseError: error instanceof Error ? error.message : 'Network error',
        isPurchasing: false,
      });
      return null;
    }
  },

  equipItem: async (inventoryItemId: string) => {
    try {
      const response = await apiClient.post('/v1/inventory/equip', { item_id: inventoryItemId });
      if (response.success) {
        set((state) => ({
          inventory: state.inventory.map((item) =>
            item.id === inventoryItemId ? { ...item, is_equipped: true } : item
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('[marketplaceStore] Failed to equip item:', error);
      return false;
    }
  },

  unequipItem: async (inventoryItemId: string) => {
    try {
      const response = await apiClient.post('/v1/inventory/unequip', { item_id: inventoryItemId });
      if (response.success) {
        set((state) => ({
          inventory: state.inventory.map((item) =>
            item.id === inventoryItemId ? { ...item, is_equipped: false } : item
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('[marketplaceStore] Failed to unequip item:', error);
      return false;
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, storeOffset: 0, storeItems: [] });
  },

  setSelectedType: (type: ItemType | null) => {
    set({ selectedType: type, storeOffset: 0, storeItems: [] });
  },

  setSelectedCategory: (categoryId: string | null) => {
    set({ selectedCategoryId: categoryId, storeOffset: 0, storeItems: [] });
  },

  reset: () => set(initialState),
}));

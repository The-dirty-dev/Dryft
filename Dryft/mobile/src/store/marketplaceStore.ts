import { create } from 'zustand';
import {
  InventoryItem,
  ItemCategory,
  ItemFilter,
  ItemType,
  StoreItem,
} from '../types';
import marketplaceApi from '../api/marketplace';

interface MarketplaceState {
  // Store
  items: StoreItem[];
  featuredItems: StoreItem[];
  popularItems: StoreItem[];
  categories: ItemCategory[];
  currentFilter: ItemFilter;
  totalItems: number;
  currentPage: number;
  isLoadingStore: boolean;

  // Inventory
  inventory: InventoryItem[];
  equippedItems: Record<ItemType, InventoryItem | null>;
  isLoadingInventory: boolean;

  // Selected
  selectedItem: StoreItem | null;

  // Error
  error: string | null;

  // Store Actions
  loadItems: (filter?: ItemFilter, page?: number) => Promise<void>;
  loadFeaturedItems: () => Promise<void>;
  loadPopularItems: () => Promise<void>;
  loadCategories: () => Promise<void>;
  searchItems: (query: string) => Promise<void>;
  setFilter: (filter: ItemFilter) => void;
  selectItem: (item: StoreItem | null) => void;

  // Inventory Actions
  loadInventory: (type?: ItemType) => Promise<void>;
  loadEquippedItems: () => Promise<void>;
  equipItem: (itemId: string) => Promise<boolean>;
  unequipItem: (itemId: string) => Promise<boolean>;

  // Purchase Actions
  purchaseItem: (itemId: string) => Promise<{ success: boolean; clientSecret?: string }>;

  // Util
  clearError: () => void;
}

const ITEMS_PER_PAGE = 20;

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  // Initial state
  items: [],
  featuredItems: [],
  popularItems: [],
  categories: [],
  currentFilter: {},
  totalItems: 0,
  currentPage: 0,
  isLoadingStore: false,

  inventory: [],
  equippedItems: {
    avatar: null,
    outfit: null,
    toy: null,
    effect: null,
    gesture: null,
  },
  isLoadingInventory: false,

  selectedItem: null,
  error: null,

  // ==========================================================================
  // Store Actions
  // ==========================================================================

  loadItems: async (filter?: ItemFilter, page = 0) => {
    set({ isLoadingStore: true, error: null });

    const currentFilter = filter ?? get().currentFilter;
    const response = await marketplaceApi.getItems(
      currentFilter,
      ITEMS_PER_PAGE,
      page * ITEMS_PER_PAGE
    );

    if (response.success && response.data) {
      set({
        items: response.data.items || [],
        totalItems: response.data.total,
        currentPage: page,
        currentFilter,
        isLoadingStore: false,
      });
    } else {
      set({
        error: response.error || 'Failed to load items',
        isLoadingStore: false,
      });
    }
  },

  loadFeaturedItems: async () => {
    const response = await marketplaceApi.getFeaturedItems(10);
    if (response.success && response.data) {
      set({ featuredItems: response.data.items || [] });
    }
  },

  loadPopularItems: async () => {
    const response = await marketplaceApi.getPopularItems(10);
    if (response.success && response.data) {
      set({ popularItems: response.data.items || [] });
    }
  },

  loadCategories: async () => {
    const response = await marketplaceApi.getCategories();
    if (response.success && response.data) {
      set({ categories: response.data.categories || [] });
    }
  },

  searchItems: async (query: string) => {
    set({ isLoadingStore: true, error: null });

    const response = await marketplaceApi.searchItems(query);

    if (response.success && response.data) {
      set({
        items: response.data.items || [],
        totalItems: response.data.total,
        currentPage: 0,
        currentFilter: { search: query },
        isLoadingStore: false,
      });
    } else {
      set({
        error: response.error || 'Search failed',
        isLoadingStore: false,
      });
    }
  },

  setFilter: (filter: ItemFilter) => {
    set({ currentFilter: filter });
    get().loadItems(filter, 0);
  },

  selectItem: (item: StoreItem | null) => {
    set({ selectedItem: item });
  },

  // ==========================================================================
  // Inventory Actions
  // ==========================================================================

  loadInventory: async (type?: ItemType) => {
    set({ isLoadingInventory: true, error: null });

    const response = await marketplaceApi.getInventory(type);

    if (response.success && response.data) {
      set({
        inventory: response.data.items || [],
        isLoadingInventory: false,
      });
    } else {
      set({
        error: response.error || 'Failed to load inventory',
        isLoadingInventory: false,
      });
    }
  },

  loadEquippedItems: async () => {
    const response = await marketplaceApi.getEquippedItems();

    if (response.success && response.data) {
      const equipped: Record<ItemType, InventoryItem | null> = {
        avatar: null,
        outfit: null,
        toy: null,
        effect: null,
        gesture: null,
      };

      for (const item of response.data.items || []) {
        if (item.item?.item_type) {
          equipped[item.item.item_type as ItemType] = item;
        }
      }

      set({ equippedItems: equipped });
    }
  },

  equipItem: async (itemId: string) => {
    const response = await marketplaceApi.equipItem(itemId);

    if (response.success) {
      // Refresh equipped items
      await get().loadEquippedItems();
      await get().loadInventory();
      return true;
    }

    set({ error: response.error || 'Failed to equip item' });
    return false;
  },

  unequipItem: async (itemId: string) => {
    const response = await marketplaceApi.unequipItem(itemId);

    if (response.success) {
      await get().loadEquippedItems();
      await get().loadInventory();
      return true;
    }

    set({ error: response.error || 'Failed to unequip item' });
    return false;
  },

  // ==========================================================================
  // Purchase Actions
  // ==========================================================================

  purchaseItem: async (itemId: string) => {
    set({ error: null });

    const response = await marketplaceApi.purchase(itemId);

    if (response.success && response.data) {
      // If free item, refresh inventory immediately
      if (response.data.amount === 0) {
        await get().loadInventory();

        // Update the item in the store list to show as owned
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, is_owned: true } : item
          ),
          selectedItem:
            state.selectedItem?.id === itemId
              ? { ...state.selectedItem, is_owned: true }
              : state.selectedItem,
        }));
      }

      return {
        success: true,
        clientSecret: response.data.client_secret,
      };
    }

    set({ error: response.error || 'Purchase failed' });
    return { success: false };
  },

  // ==========================================================================
  // Util
  // ==========================================================================

  clearError: () => set({ error: null }),
}));

export default useMarketplaceStore;

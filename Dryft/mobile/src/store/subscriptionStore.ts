import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import purchasesService from '../services/purchases';
import { api } from '../api/client';

// Subscription tiers
export type SubscriptionTier = 'free' | 'plus' | 'premium' | 'vip';

// Product IDs (must match App Store Connect / Google Play Console)
export const PRODUCT_IDS = {
  PLUS_MONTHLY: 'dryft_plus_monthly',
  PLUS_YEARLY: 'dryft_plus_yearly',
  PREMIUM_MONTHLY: 'dryft_premium_monthly',
  PREMIUM_YEARLY: 'dryft_premium_yearly',
  VIP_MONTHLY: 'dryft_vip_monthly',
  VIP_YEARLY: 'dryft_vip_yearly',
  // Consumables
  BOOST_1: 'dryft_boost_1',
  BOOST_5: 'dryft_boost_5',
  SUPER_LIKE_5: 'dryft_super_like_5',
  SUPER_LIKE_15: 'dryft_super_like_15',
};

export interface Product {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmount: number;
  currency: string;
  subscriptionPeriod?: string;
  tier?: SubscriptionTier;
}

export interface Subscription {
  tier: SubscriptionTier;
  productId: string;
  expiresAt: string;
  willRenew: boolean;
  purchaseDate: string;
  platform: 'ios' | 'android';
}

export interface Entitlements {
  // Matching
  dailyLikes: number; // -1 = unlimited
  dailySuperLikes: number;
  rewind: boolean;
  seeWhoLikesYou: boolean;
  advancedFilters: boolean;

  // VR Features
  vrAccess: boolean;
  privateVRRooms: boolean;
  customAvatars: boolean;
  premiumEnvironments: boolean;

  // Profile
  profileBoosts: number;
  priorityMatching: boolean;
  readReceipts: boolean;
  incognitoMode: boolean;

  // Support
  prioritySupport: boolean;
}

const FREE_ENTITLEMENTS: Entitlements = {
  dailyLikes: 50,
  dailySuperLikes: 1,
  rewind: false,
  seeWhoLikesYou: false,
  advancedFilters: false,
  vrAccess: true,
  privateVRRooms: false,
  customAvatars: false,
  premiumEnvironments: false,
  profileBoosts: 0,
  priorityMatching: false,
  readReceipts: false,
  incognitoMode: false,
  prioritySupport: false,
};

const PLUS_ENTITLEMENTS: Entitlements = {
  dailyLikes: -1, // Unlimited
  dailySuperLikes: 5,
  rewind: true,
  seeWhoLikesYou: true,
  advancedFilters: true,
  vrAccess: true,
  privateVRRooms: false,
  customAvatars: false,
  premiumEnvironments: false,
  profileBoosts: 1,
  priorityMatching: false,
  readReceipts: true,
  incognitoMode: false,
  prioritySupport: false,
};

const PREMIUM_ENTITLEMENTS: Entitlements = {
  dailyLikes: -1,
  dailySuperLikes: -1,
  rewind: true,
  seeWhoLikesYou: true,
  advancedFilters: true,
  vrAccess: true,
  privateVRRooms: true,
  customAvatars: true,
  premiumEnvironments: true,
  profileBoosts: 3,
  priorityMatching: true,
  readReceipts: true,
  incognitoMode: true,
  prioritySupport: false,
};

const VIP_ENTITLEMENTS: Entitlements = {
  dailyLikes: -1,
  dailySuperLikes: -1,
  rewind: true,
  seeWhoLikesYou: true,
  advancedFilters: true,
  vrAccess: true,
  privateVRRooms: true,
  customAvatars: true,
  premiumEnvironments: true,
  profileBoosts: 5,
  priorityMatching: true,
  readReceipts: true,
  incognitoMode: true,
  prioritySupport: true,
};

export interface SubscriptionState {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  products: Product[];
  subscription: Subscription | null;
  entitlements: Entitlements;

  // Consumables
  boostsRemaining: number;
  superLikesRemaining: number;

  // Actions
  initialize: () => Promise<void>;
  loadProducts: () => Promise<void>;
  purchaseProduct: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<void>;
  useBoost: () => Promise<boolean>;
  useSuperLike: () => Promise<boolean>;
  hasEntitlement: (feature: keyof Entitlements) => boolean;
  clearError: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      isLoading: false,
      error: null,
      products: [],
      subscription: null,
      entitlements: FREE_ENTITLEMENTS,
      boostsRemaining: 0,
      superLikesRemaining: 0,

      initialize: async () => {
        if (get().isInitialized) return;

        set({ isLoading: true, error: null });
        try {
          await purchasesService.initialize();
          await get().loadProducts();
          await get().checkSubscriptionStatus();
          set({ isInitialized: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      loadProducts: async () => {
        try {
          const offerings = await purchasesService.fetchOfferings();
          const products: Product[] = [];

          for (const offering of offerings) {
            for (const pkg of offering.availablePackages) {
              const p = purchasesService.transformPackageToProduct(pkg);
              products.push({
                productId: p.id,
                title: p.title,
                description: p.description,
                price: p.price,
                priceAmount: p.priceNumber,
                currency: p.currency,
                subscriptionPeriod: p.period,
                tier: p.tier,
              });
            }
          }

          set({ products });
        } catch (error: any) {
          console.error('Failed to load products:', error);
        }
      },

      purchaseProduct: async (productId: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await purchasesService.purchaseProduct(productId);
          if (result.success) {
            await get().checkSubscriptionStatus();
            set({ isLoading: false });
            return true;
          } else if (result.userCancelled) {
            set({ isLoading: false });
            return false;
          } else {
            set({ error: result.error ?? 'Purchase failed', isLoading: false });
            return false;
          }
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return false;
        }
      },

      restorePurchases: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await purchasesService.restorePurchases();
          if (result.success) {
            await get().checkSubscriptionStatus();
          } else {
            set({ error: result.error ?? 'Restore failed' });
          }
          set({ isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      checkSubscriptionStatus: async () => {
        try {
          const response = await api.get('/subscriptions/status');
          const data = response.data;

          if (data.subscription) {
            const sub: Subscription = {
              tier: data.subscription.tier,
              productId: data.subscription.product_id,
              expiresAt: data.subscription.expires_at,
              willRenew: data.subscription.will_renew,
              purchaseDate: data.subscription.purchase_date,
              platform: data.subscription.platform,
            };

            set({
              subscription: sub,
              entitlements: getEntitlementsForTier(sub.tier),
              boostsRemaining: data.boosts_remaining || 0,
              superLikesRemaining: data.super_likes_remaining || 0,
            });
          } else {
            set({
              subscription: null,
              entitlements: FREE_ENTITLEMENTS,
              boostsRemaining: data.boosts_remaining || 0,
              superLikesRemaining: data.super_likes_remaining || 0,
            });
          }
        } catch (error) {
          console.error('Failed to check subscription:', error);
        }
      },

      useBoost: async () => {
        const { boostsRemaining, entitlements } = get();
        if (boostsRemaining <= 0 && entitlements.profileBoosts <= 0) {
          return false;
        }

        try {
          const response = await api.post('/subscriptions/use-boost');
          if (response.data.success) {
            set({ boostsRemaining: response.data.boosts_remaining });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      useSuperLike: async () => {
        const { superLikesRemaining, entitlements } = get();
        if (superLikesRemaining <= 0 && entitlements.dailySuperLikes <= 0) {
          return false;
        }

        try {
          const response = await api.post('/subscriptions/use-super-like');
          if (response.data.success) {
            set({ superLikesRemaining: response.data.super_likes_remaining });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      hasEntitlement: (feature: keyof Entitlements) => {
        const { entitlements } = get();
        const value = entitlements[feature];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        return false;
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'dryft-subscription',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        subscription: state.subscription,
        entitlements: state.entitlements,
        boostsRemaining: state.boostsRemaining,
        superLikesRemaining: state.superLikesRemaining,
      }),
    }
  )
);

// Helper functions
function getEntitlementsForTier(tier: SubscriptionTier): Entitlements {
  switch (tier) {
    case 'vip':
      return VIP_ENTITLEMENTS;
    case 'premium':
      return PREMIUM_ENTITLEMENTS;
    case 'plus':
      return PLUS_ENTITLEMENTS;
    default:
      return FREE_ENTITLEMENTS;
  }
}

// Export entitlement configs for reference
export const TIER_ENTITLEMENTS = {
  free: FREE_ENTITLEMENTS,
  plus: PLUS_ENTITLEMENTS,
  premium: PREMIUM_ENTITLEMENTS,
  vip: VIP_ENTITLEMENTS,
};

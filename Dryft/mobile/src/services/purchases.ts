import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  PurchasesEntitlementInfo,
  PRODUCT_CATEGORY,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from './analytics';

/**
 * In-app purchases service (RevenueCat wrapper).
 * Handles offerings, purchases, entitlements, and subscription caching.
 * @example
 * const offerings = await getOfferings();
 */
// ============================================================================
// Types
// ============================================================================

export type SubscriptionTier = 'free' | 'plus' | 'premium' | 'vip';

export type ProductType = 'subscription' | 'consumable' | 'non_consumable';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  priceNumber: number;
  currency: string;
  type: ProductType;
  tier?: SubscriptionTier;
  period?: string;
  periodUnit?: 'day' | 'week' | 'month' | 'year';
  periodNumber?: number;
  introPrice?: string;
  introPeriod?: string;
  features?: string[];
}

export interface Entitlement {
  id: string;
  isActive: boolean;
  willRenew: boolean;
  expirationDate?: Date;
  productId?: string;
  isSandbox: boolean;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  willRenew: boolean;
  expirationDate?: Date;
  managementUrl?: string;
  entitlements: Record<string, Entitlement>;
}

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
  userCancelled?: boolean;
}

type CustomerInfoListener = (info: CustomerInfo) => void;

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  SUBSCRIPTION_CACHE: 'dryft_subscription_cache',
  LAST_SYNC: 'dryft_purchases_last_sync',
};

// RevenueCat API keys (would be in env vars in real app)
const API_KEYS = {
  ios: 'appl_XXXXXXXXXXXXXXXXXXXXXXXX',
  android: 'goog_XXXXXXXXXXXXXXXXXXXXXXXX',
};

// Entitlement IDs
const ENTITLEMENT_IDS = {
  plus: 'dryft_plus',
  premium: 'dryft_premium',
  vip: 'dryft_vip',
  superLikes: 'super_likes',
  boosts: 'boosts',
  rewinds: 'rewinds',
  seeWhoLikes: 'see_who_likes',
  unlimitedLikes: 'unlimited_likes',
  vrAccess: 'vr_access',
  advancedFilters: 'advanced_filters',
  readReceipts: 'read_receipts',
  priorityMatching: 'priority_matching',
};

// Product IDs
const PRODUCT_IDS = {
  // Subscriptions
  plusMonthly: 'dryft_plus_monthly',
  plusYearly: 'dryft_plus_yearly',
  premiumMonthly: 'dryft_premium_monthly',
  premiumYearly: 'dryft_premium_yearly',
  vipMonthly: 'dryft_vip_monthly',
  vipYearly: 'dryft_vip_yearly',
  // Consumables
  superLike5: 'super_like_5',
  superLike15: 'super_like_15',
  superLike30: 'super_like_30',
  boost1: 'boost_1',
  boost5: 'boost_5',
  boost10: 'boost_10',
};

// Tier hierarchy (higher index = higher tier)
const TIER_HIERARCHY: SubscriptionTier[] = ['free', 'plus', 'premium', 'vip'];

// Features by tier
const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    'Basic swiping',
    'Limited likes per day',
    '1 Super Like per week',
  ],
  plus: [
    'Unlimited likes',
    '5 Super Likes per day',
    'See who likes you',
    'Rewind last swipe',
    '1 Boost per month',
  ],
  premium: [
    'Everything in Plus',
    'Priority matching',
    'Advanced filters',
    'Read receipts',
    'VR date access',
    '3 Boosts per month',
  ],
  vip: [
    'Everything in Premium',
    'Unlimited VR dates',
    'Profile highlighting',
    'Dedicated support',
    'Unlimited Boosts',
    'First access to new features',
  ],
};

// ============================================================================
// Purchases Service
// ============================================================================

class PurchasesService {
  private static instance: PurchasesService;
  private initialized = false;
  private customerInfo: CustomerInfo | null = null;
  private offerings: PurchasesOffering[] = [];
  private listeners: Set<CustomerInfoListener> = new Set();

  private constructor() {}

  static getInstance(): PurchasesService {
    if (!PurchasesService.instance) {
      PurchasesService.instance = new PurchasesService();
    }
    return PurchasesService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(userId?: string): Promise<void> {
    if (this.initialized) return;

    try {
      // Configure RevenueCat
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      const apiKey = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;

      await Purchases.configure({
        apiKey,
        appUserID: userId,
      });

      // Set up customer info listener
      Purchases.addCustomerInfoUpdateListener(this.handleCustomerInfoUpdate);

      // Get initial customer info
      this.customerInfo = await Purchases.getCustomerInfo();

      // Fetch offerings
      await this.fetchOfferings();

      // Cache subscription state
      await this.cacheSubscriptionStatus();

      this.initialized = true;
      console.log('[Purchases] Initialized');
    } catch (error) {
      console.error('[Purchases] Initialization failed:', error);
      throw error;
    }
  }

  async setUserId(userId: string): Promise<void> {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      this.customerInfo = customerInfo;
      await this.cacheSubscriptionStatus();
    } catch (error) {
      console.error('[Purchases] Failed to set user ID:', error);
    }
  }

  async logout(): Promise<void> {
    try {
      const { customerInfo } = await Purchases.logOut();
      this.customerInfo = customerInfo;
      await AsyncStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION_CACHE);
    } catch (error) {
      console.error('[Purchases] Logout failed:', error);
    }
  }

  // ==========================================================================
  // Customer Info
  // ==========================================================================

  private handleCustomerInfoUpdate = (info: CustomerInfo): void => {
    this.customerInfo = info;
    this.cacheSubscriptionStatus();
    this.notifyListeners(info);

    trackEvent('subscription_updated', {
      tier: this.getCurrentTier(),
      active_entitlements: Object.keys(info.entitlements.active).join(','),
    });
  };

  async refreshCustomerInfo(): Promise<CustomerInfo> {
    this.customerInfo = await Purchases.getCustomerInfo();
    await this.cacheSubscriptionStatus();
    return this.customerInfo;
  }

  getCustomerInfo(): CustomerInfo | null {
    return this.customerInfo;
  }

  // ==========================================================================
  // Offerings & Products
  // ==========================================================================

  async fetchOfferings(): Promise<PurchasesOffering[]> {
    try {
      const offerings = await Purchases.getOfferings();
      this.offerings = offerings.all ? Object.values(offerings.all) : [];

      return this.offerings;
    } catch (error) {
      console.error('[Purchases] Failed to fetch offerings:', error);
      return [];
    }
  }

  getOfferings(): PurchasesOffering[] {
    return this.offerings;
  }

  getCurrentOffering(): PurchasesOffering | null {
    return this.offerings.find((o) => o.identifier === 'default') || this.offerings[0] || null;
  }

  getOfferingByTier(tier: SubscriptionTier): PurchasesOffering | null {
    return this.offerings.find((o) => o.identifier === tier) || null;
  }

  getPackagesByTier(tier: SubscriptionTier): PurchasesPackage[] {
    const offering = this.getOfferingByTier(tier);
    return offering?.availablePackages || [];
  }

  transformPackageToProduct(pkg: PurchasesPackage): Product {
    const product = pkg.product;
    const tier = this.getTierFromProductId(product.identifier);

    return {
      id: product.identifier,
      title: product.title,
      description: product.description,
      price: product.priceString,
      priceNumber: product.price,
      currency: product.currencyCode,
      type: product.productCategory === PRODUCT_CATEGORY.SUBSCRIPTION
        ? 'subscription'
        : 'consumable',
      tier,
      period: product.subscriptionPeriod,
      features: tier ? TIER_FEATURES[tier] : undefined,
    };
  }

  private getTierFromProductId(productId: string): SubscriptionTier | undefined {
    if (productId.includes('vip')) return 'vip';
    if (productId.includes('premium')) return 'premium';
    if (productId.includes('plus')) return 'plus';
    return undefined;
  }

  // ==========================================================================
  // Subscription Status
  // ==========================================================================

  getSubscriptionStatus(): SubscriptionStatus {
    if (!this.customerInfo) {
      return {
        tier: 'free',
        isActive: false,
        willRenew: false,
        entitlements: {},
      };
    }

    const tier = this.getCurrentTier();
    const activeEntitlements = this.customerInfo.entitlements.active;
    const entitlements: Record<string, Entitlement> = {};

    Object.entries(activeEntitlements).forEach(([id, ent]) => {
      entitlements[id] = {
        id,
        isActive: ent.isActive,
        willRenew: ent.willRenew,
        expirationDate: ent.expirationDate ? new Date(ent.expirationDate) : undefined,
        productId: ent.productIdentifier,
        isSandbox: ent.isSandbox,
      };
    });

    // Get primary subscription entitlement
    const primaryEnt = activeEntitlements[ENTITLEMENT_IDS[tier]] ||
      Object.values(activeEntitlements)[0];

    return {
      tier,
      isActive: tier !== 'free',
      willRenew: primaryEnt?.willRenew || false,
      expirationDate: primaryEnt?.expirationDate
        ? new Date(primaryEnt.expirationDate)
        : undefined,
      managementUrl: this.customerInfo.managementURL || undefined,
      entitlements,
    };
  }

  getCurrentTier(): SubscriptionTier {
    if (!this.customerInfo) return 'free';

    const activeEntitlements = this.customerInfo.entitlements.active;

    // Check from highest to lowest tier
    if (activeEntitlements[ENTITLEMENT_IDS.vip]) return 'vip';
    if (activeEntitlements[ENTITLEMENT_IDS.premium]) return 'premium';
    if (activeEntitlements[ENTITLEMENT_IDS.plus]) return 'plus';

    return 'free';
  }

  hasEntitlement(entitlementId: string): boolean {
    return !!this.customerInfo?.entitlements.active[entitlementId];
  }

  hasTierOrHigher(tier: SubscriptionTier): boolean {
    const currentTier = this.getCurrentTier();
    const currentIndex = TIER_HIERARCHY.indexOf(currentTier);
    const requiredIndex = TIER_HIERARCHY.indexOf(tier);
    return currentIndex >= requiredIndex;
  }

  // Feature checks
  hasUnlimitedLikes(): boolean {
    return this.hasTierOrHigher('plus');
  }

  canSeeWhoLikes(): boolean {
    return this.hasTierOrHigher('plus');
  }

  hasVRAccess(): boolean {
    return this.hasTierOrHigher('premium');
  }

  hasAdvancedFilters(): boolean {
    return this.hasTierOrHigher('premium');
  }

  hasPriorityMatching(): boolean {
    return this.hasTierOrHigher('premium');
  }

  // ==========================================================================
  // Purchases
  // ==========================================================================

  async purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
    try {
      trackEvent('purchase_started', {
        product_id: pkg.product.identifier,
        price: pkg.product.price,
      });

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      this.customerInfo = customerInfo;

      trackEvent('purchase_completed', {
        product_id: pkg.product.identifier,
        price: pkg.product.price,
        tier: this.getCurrentTier(),
      });

      return {
        success: true,
        customerInfo,
      };
    } catch (error: any) {
      const userCancelled = error.userCancelled;

      if (!userCancelled) {
        trackEvent('purchase_failed', {
          product_id: pkg.product.identifier,
          error: error.message,
        });
      }

      return {
        success: false,
        error: error.message,
        userCancelled,
      };
    }
  }

  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    // Find the package with this product
    for (const offering of this.offerings) {
      const pkg = offering.availablePackages.find(
        (p) => p.product.identifier === productId
      );
      if (pkg) {
        return this.purchasePackage(pkg);
      }
    }

    return {
      success: false,
      error: 'Product not found',
    };
  }

  async restorePurchases(): Promise<PurchaseResult> {
    try {
      trackEvent('restore_purchases_started', {});

      const customerInfo = await Purchases.restorePurchases();
      this.customerInfo = customerInfo;

      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;

      trackEvent('restore_purchases_completed', {
        has_active: hasActiveSubscription,
        tier: this.getCurrentTier(),
      });

      return {
        success: true,
        customerInfo,
      };
    } catch (error: any) {
      trackEvent('restore_purchases_failed', {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==========================================================================
  // Consumables
  // ==========================================================================

  async getSuperLikeBalance(): Promise<number> {
    // This would typically be stored server-side
    // RevenueCat doesn't track consumable balances
    try {
      const stored = await AsyncStorage.getItem('dryft_super_like_balance');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  async getBoostBalance(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem('dryft_boost_balance');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // Caching
  // ==========================================================================

  private async cacheSubscriptionStatus(): Promise<void> {
    try {
      const status = this.getSubscriptionStatus();
      await AsyncStorage.setItem(
        STORAGE_KEYS.SUBSCRIPTION_CACHE,
        JSON.stringify({
          ...status,
          cachedAt: Date.now(),
        })
      );
    } catch (error) {
      console.error('[Purchases] Failed to cache status:', error);
    }
  }

  async getCachedSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_CACHE);
      if (stored) {
        const cached = JSON.parse(stored);
        // Cache valid for 1 hour
        if (Date.now() - cached.cachedAt < 60 * 60 * 1000) {
          return cached;
        }
      }
    } catch (error) {
      console.error('[Purchases] Failed to get cached status:', error);
    }
    return null;
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  addListener(listener: CustomerInfoListener): () => void {
    this.listeners.add(listener);
    if (this.customerInfo) {
      listener(this.customerInfo);
    }
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(info: CustomerInfo): void {
    this.listeners.forEach((listener) => {
      try {
        listener(info);
      } catch (error) {
        console.error('[Purchases] Listener error:', error);
      }
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getTierFeatures(tier: SubscriptionTier): string[] {
    return TIER_FEATURES[tier] || [];
  }

  getTierName(tier: SubscriptionTier): string {
    const names: Record<SubscriptionTier, string> = {
      free: 'Free',
      plus: 'Dryft Plus',
      premium: 'Dryft Premium',
      vip: 'Dryft VIP',
    };
    return names[tier];
  }

  getManagementUrl(): string | null {
    return this.customerInfo?.managementURL || null;
  }
}

export const purchasesService = PurchasesService.getInstance();
export default purchasesService;

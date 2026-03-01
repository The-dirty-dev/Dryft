import { useState, useEffect, useCallback, useMemo } from 'react';
import { Linking, Alert } from 'react-native';
import { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import {
  purchasesService,
  SubscriptionTier,
  SubscriptionStatus,
  Product,
  PurchaseResult,
} from '../services/purchases';

// ============================================================================
// useSubscription - Main subscription hook
// ============================================================================

/**
 * React hook `useSubscription`.
 * @returns Hook state and actions.
 * @example
 * const value = useSubscription();
 */
export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>(
    purchasesService.getSubscriptionStatus()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = purchasesService.addListener((info) => {
      setStatus(purchasesService.getSubscriptionStatus());
    });

    // Refresh on mount
    purchasesService.refreshCustomerInfo().catch(console.error);

    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await purchasesService.refreshCustomerInfo();
      setStatus(purchasesService.getSubscriptionStatus());
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    ...status,
    isLoading,
    refresh,
    tierName: purchasesService.getTierName(status.tier),
    features: purchasesService.getTierFeatures(status.tier),
  };
}

// ============================================================================
// useEntitlements - Check specific entitlements
// ============================================================================

/**
 * React hook `useEntitlements`.
 * @returns Hook state and actions.
 * @example
 * const value = useEntitlements();
 */
export function useEntitlements() {
  const { tier, entitlements } = useSubscription();

  return useMemo(
    () => ({
      tier,
      isPremium: tier !== 'free',
      hasUnlimitedLikes: purchasesService.hasUnlimitedLikes(),
      canSeeWhoLikes: purchasesService.canSeeWhoLikes(),
      hasVRAccess: purchasesService.hasVRAccess(),
      hasAdvancedFilters: purchasesService.hasAdvancedFilters(),
      hasPriorityMatching: purchasesService.hasPriorityMatching(),
      hasEntitlement: (id: string) => purchasesService.hasEntitlement(id),
      hasTierOrHigher: (t: SubscriptionTier) => purchasesService.hasTierOrHigher(t),
    }),
    [tier, entitlements]
  );
}

// ============================================================================
// useOfferings - Get available products/packages
// ============================================================================

/**
 * React hook `useOfferings`.
 * @returns Hook state and actions.
 * @example
 * const value = useOfferings();
 */
export function useOfferings() {
  const [offerings, setOfferings] = useState<PurchasesPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOfferings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await purchasesService.fetchOfferings();
        const current = purchasesService.getCurrentOffering();
        setOfferings(current?.availablePackages || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOfferings();
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await purchasesService.fetchOfferings();
      const current = purchasesService.getCurrentOffering();
      setOfferings(current?.availablePackages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const products = useMemo(
    () => offerings.map((pkg) => purchasesService.transformPackageToProduct(pkg)),
    [offerings]
  );

  const getPackageByTier = useCallback(
    (tier: SubscriptionTier, period: 'monthly' | 'yearly' = 'monthly') => {
      return offerings.find((pkg) => {
        const id = pkg.product.identifier.toLowerCase();
        return id.includes(tier) && id.includes(period);
      });
    },
    [offerings]
  );

  return {
    offerings,
    products,
    isLoading,
    error,
    refresh,
    getPackageByTier,
  };
}

// ============================================================================
// usePurchase - Handle purchases
// ============================================================================

/**
 * React hook `usePurchase`.
 * @returns Hook state and actions.
 * @example
 * const value = usePurchase();
 */
export function usePurchase() {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
      setIsPurchasing(true);
      setError(null);

      try {
        const result = await purchasesService.purchasePackage(pkg);

        if (!result.success && !result.userCancelled) {
          setError(result.error || 'Purchase failed');
        }

        return result;
      } catch (err: any) {
        setError(err.message);
        return {
          success: false,
          error: err.message,
        };
      } finally {
        setIsPurchasing(false);
      }
    },
    []
  );

  const purchaseById = useCallback(async (productId: string): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    setError(null);

    try {
      const result = await purchasesService.purchaseProduct(productId);

      if (!result.success && !result.userCancelled) {
        setError(result.error || 'Purchase failed');
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        error: err.message,
      };
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    setError(null);

    try {
      const result = await purchasesService.restorePurchases();

      if (!result.success) {
        setError(result.error || 'Restore failed');
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        error: err.message,
      };
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    purchase,
    purchaseById,
    restore,
    isPurchasing,
    error,
    clearError,
  };
}

// ============================================================================
// usePaywall - Paywall logic hook
// ============================================================================

/**
 * React hook `usePaywall`.
 * @param requiredTier - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = usePaywall(requiredTier);
 */
export function usePaywall(requiredTier: SubscriptionTier = 'plus') {
  const { tier, isActive } = useSubscription();
  const { hasTierOrHigher } = useEntitlements();

  const hasAccess = useMemo(
    () => hasTierOrHigher(requiredTier),
    [hasTierOrHigher, requiredTier]
  );

  const [showPaywall, setShowPaywall] = useState(false);

  const checkAccess = useCallback(
    (onGranted?: () => void) => {
      if (hasAccess) {
        onGranted?.();
        return true;
      }
      setShowPaywall(true);
      return false;
    },
    [hasAccess]
  );

  const dismissPaywall = useCallback(() => {
    setShowPaywall(false);
  }, []);

  return {
    hasAccess,
    currentTier: tier,
    requiredTier,
    showPaywall,
    checkAccess,
    dismissPaywall,
  };
}

// ============================================================================
// useManageSubscription - Subscription management
// ============================================================================

/**
 * React hook `useManageSubscription`.
 * @returns Hook state and actions.
 * @example
 * const value = useManageSubscription();
 */
export function useManageSubscription() {
  const { managementUrl, isActive, willRenew, expirationDate } = useSubscription();

  const openManagement = useCallback(async () => {
    if (managementUrl) {
      const canOpen = await Linking.canOpenURL(managementUrl);
      if (canOpen) {
        await Linking.openURL(managementUrl);
      }
    } else {
      Alert.alert(
        'Manage Subscription',
        'To manage your subscription, go to your device Settings > Apple ID > Subscriptions'
      );
    }
  }, [managementUrl]);

  const getStatusText = useCallback(() => {
    if (!isActive) return 'No active subscription';

    if (!willRenew && expirationDate) {
      const date = expirationDate.toLocaleDateString();
      return `Expires on ${date}`;
    }

    if (expirationDate) {
      const date = expirationDate.toLocaleDateString();
      return `Renews on ${date}`;
    }

    return 'Active';
  }, [isActive, willRenew, expirationDate]);

  return {
    openManagement,
    getStatusText,
    canManage: !!managementUrl,
    isActive,
    willRenew,
    expirationDate,
  };
}

// ============================================================================
// useConsumables - Track consumable balances
// ============================================================================

/**
 * React hook `useConsumables`.
 * @returns Hook state and actions.
 * @example
 * const value = useConsumables();
 */
export function useConsumables() {
  const [superLikes, setSuperLikes] = useState(0);
  const [boosts, setBoosts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      setIsLoading(true);
      try {
        const [sl, b] = await Promise.all([
          purchasesService.getSuperLikeBalance(),
          purchasesService.getBoostBalance(),
        ]);
        setSuperLikes(sl);
        setBoosts(b);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, []);

  const refresh = useCallback(async () => {
    const [sl, b] = await Promise.all([
      purchasesService.getSuperLikeBalance(),
      purchasesService.getBoostBalance(),
    ]);
    setSuperLikes(sl);
    setBoosts(b);
  }, []);

  return {
    superLikes,
    boosts,
    isLoading,
    refresh,
    hasSuperLikes: superLikes > 0,
    hasBoosts: boosts > 0,
  };
}

// ============================================================================
// usePremiumFeature - Gate a feature behind premium
// ============================================================================

export function usePremiumFeature(
  featureCheck: () => boolean,
  requiredTier: SubscriptionTier = 'plus'
) {
  const hasAccess = featureCheck();
  const { checkAccess, showPaywall, dismissPaywall } = usePaywall(requiredTier);

  const executeIfAllowed = useCallback(
    <T>(action: () => T): T | undefined => {
      if (hasAccess) {
        return action();
      }
      checkAccess();
      return undefined;
    },
    [hasAccess, checkAccess]
  );

  return {
    hasAccess,
    requiredTier,
    showPaywall,
    dismissPaywall,
    executeIfAllowed,
  };
}

export default {
  useSubscription,
  useEntitlements,
  useOfferings,
  usePurchase,
  usePaywall,
  useManageSubscription,
  useConsumables,
  usePremiumFeature,
};

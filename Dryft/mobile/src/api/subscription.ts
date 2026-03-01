import apiClient from './client';
import { ApiResponse } from '../types';

export interface Entitlements {
  daily_likes: number;
  daily_super_likes: number;
  rewind: boolean;
  see_who_likes_you: boolean;
  advanced_filters: boolean;
  vr_access: boolean;
  private_vr_rooms: boolean;
  custom_avatars: boolean;
  premium_environments: boolean;
  monthly_boosts: number;
  priority_matching: boolean;
  read_receipts: boolean;
  incognito_mode: boolean;
  priority_support: boolean;
}

export interface SubscriptionInfo {
  tier: string;
  product_id: string;
  expires_at: string;
  will_renew: boolean;
  purchase_date: string;
  platform: string;
}

export interface SubscriptionStatus {
  subscription?: SubscriptionInfo | null;
  tier: string;
  boosts_remaining: number;
  super_likes_remaining: number;
  daily_likes_remaining: number;
  entitlements: Entitlements;
}

export interface VerifyPurchaseRequest {
  product_id: string;
  receipt: string;
  platform: string;
}

export const subscriptionApi = {
  /**
   * Get subscription status and entitlements.
   */
  async getStatus(): Promise<ApiResponse<SubscriptionStatus>> {
    return apiClient.get<SubscriptionStatus>('/v1/subscriptions/status');
  },

  /**
   * Get entitlements only.
   */
  async getEntitlements(): Promise<ApiResponse<Entitlements>> {
    return apiClient.get<Entitlements>('/v1/subscriptions/entitlements');
  },

  /**
   * Verify a purchase/receipt.
   */
  async verifyPurchase(data: VerifyPurchaseRequest): Promise<ApiResponse<SubscriptionStatus>> {
    return apiClient.post<SubscriptionStatus>('/v1/subscriptions/verify', data);
  },

  /**
   * Restore purchases.
   */
  async restorePurchases(): Promise<ApiResponse<SubscriptionStatus>> {
    return apiClient.post<SubscriptionStatus>('/v1/subscriptions/restore');
  },

  /**
   * Cancel subscription.
   */
  async cancelSubscription(): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/subscriptions/cancel');
  },

  /**
   * Use a boost credit.
   */
  async useBoost(): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/subscriptions/use-boost');
  },

  /**
   * Use a super like credit.
   */
  async useSuperLike(): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/subscriptions/use-super-like');
  },

  /**
   * Use a daily like credit.
   */
  async useLike(): Promise<ApiResponse<{ status: string }>> {
    return apiClient.post<{ status: string }>('/v1/subscriptions/use-like');
  },

  /**
   * Check if user has a specific entitlement.
   */
  async hasEntitlement(entitlement: string): Promise<ApiResponse<{ has: boolean }>> {
    return apiClient.get<{ has: boolean }>(`/v1/subscriptions/has/${entitlement}`);
  },
};

export default subscriptionApi;

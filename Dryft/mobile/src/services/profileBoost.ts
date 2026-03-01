import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type BoostType = 'standard' | 'super' | 'spotlight';

export interface BoostStatus {
  isActive: boolean;
  type: BoostType;
  startedAt: string;
  expiresAt: string;
  remainingMinutes: number;
  viewsGained: number;
  likesGained: number;
  matchesGained: number;
}

export interface BoostPackage {
  id: string;
  type: BoostType;
  name: string;
  description: string;
  durationMinutes: number;
  multiplier: number;
  price: number;
  currency: string;
  features: string[];
  isBestValue?: boolean;
}

export interface BoostHistory {
  id: string;
  type: BoostType;
  startedAt: string;
  endedAt: string;
  viewsGained: number;
  likesGained: number;
  matchesGained: number;
}

export interface SpotlightSlot {
  position: number;
  userId: string;
  userName: string;
  userPhoto: string;
  expiresAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  BOOST_STATUS: 'dryft_boost_status',
  FREE_BOOSTS: 'dryft_free_boosts',
  BOOST_HISTORY: 'dryft_boost_history',
};

const BOOST_PACKAGES: BoostPackage[] = [
  {
    id: 'boost_standard_30',
    type: 'standard',
    name: '30-Minute Boost',
    description: 'Get 3x more visibility for 30 minutes',
    durationMinutes: 30,
    multiplier: 3,
    price: 4.99,
    currency: 'USD',
    features: [
      '3x more profile views',
      'Priority in discovery',
      'Boost indicator on profile',
    ],
  },
  {
    id: 'boost_super_60',
    type: 'super',
    name: 'Super Boost',
    description: 'Get 10x more visibility for 60 minutes',
    durationMinutes: 60,
    multiplier: 10,
    price: 9.99,
    currency: 'USD',
    isBestValue: true,
    features: [
      '10x more profile views',
      'Top of discovery',
      'Super Boost badge',
      'See who viewed you',
    ],
  },
  {
    id: 'spotlight_3h',
    type: 'spotlight',
    name: 'Spotlight',
    description: 'Be featured on the spotlight carousel',
    durationMinutes: 180,
    multiplier: 20,
    price: 19.99,
    currency: 'USD',
    features: [
      'Featured in spotlight carousel',
      'Maximum visibility',
      'Spotlight crown badge',
      'Priority messaging',
      'Analytics dashboard',
    ],
  },
];

// ============================================================================
// Profile Boost Service
// ============================================================================

class ProfileBoostService {
  private static instance: ProfileBoostService;
  private currentBoost: BoostStatus | null = null;
  private freeBoosts: number = 0;
  private boostHistory: BoostHistory[] = [];
  private listeners: Set<() => void> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): ProfileBoostService {
    if (!ProfileBoostService.instance) {
      ProfileBoostService.instance = new ProfileBoostService();
    }
    return ProfileBoostService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadBoostStatus(),
      this.loadFreeBoosts(),
      this.loadBoostHistory(),
    ]);

    // Start checking for boost expiry
    this.startExpiryCheck();

    this.initialized = true;
    console.log('[ProfileBoost] Initialized');
  }

  private async loadBoostStatus(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BOOST_STATUS);
      if (stored) {
        const status: BoostStatus = JSON.parse(stored);
        if (new Date(status.expiresAt) > new Date()) {
          this.currentBoost = status;
        } else {
          await AsyncStorage.removeItem(STORAGE_KEYS.BOOST_STATUS);
        }
      }
    } catch (error) {
      console.error('[ProfileBoost] Failed to load status:', error);
    }
  }

  private async loadFreeBoosts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FREE_BOOSTS);
      this.freeBoosts = stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      console.error('[ProfileBoost] Failed to load free boosts:', error);
    }
  }

  private async loadBoostHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.BOOST_HISTORY);
      if (stored) {
        this.boostHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ProfileBoost] Failed to load history:', error);
    }
  }

  private startExpiryCheck(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      if (this.currentBoost) {
        const remaining = this.getRemainingMinutes();
        if (remaining <= 0) {
          this.handleBoostExpired();
        } else {
          this.currentBoost.remainingMinutes = remaining;
          this.notifyListeners();
        }
      }
    }, 60000); // Check every minute
  }

  private stopExpiryCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async handleBoostExpired(): Promise<void> {
    if (!this.currentBoost) return;

    // Save to history
    const historyEntry: BoostHistory = {
      id: `history_${Date.now()}`,
      type: this.currentBoost.type,
      startedAt: this.currentBoost.startedAt,
      endedAt: this.currentBoost.expiresAt,
      viewsGained: this.currentBoost.viewsGained,
      likesGained: this.currentBoost.likesGained,
      matchesGained: this.currentBoost.matchesGained,
    };

    this.boostHistory.unshift(historyEntry);
    this.boostHistory = this.boostHistory.slice(0, 50); // Keep last 50

    await AsyncStorage.setItem(
      STORAGE_KEYS.BOOST_HISTORY,
      JSON.stringify(this.boostHistory)
    );

    // Clear current boost
    this.currentBoost = null;
    await AsyncStorage.removeItem(STORAGE_KEYS.BOOST_STATUS);

    trackEvent('boost_expired', {
      type: historyEntry.type,
      views_gained: historyEntry.viewsGained,
      likes_gained: historyEntry.likesGained,
      matches_gained: historyEntry.matchesGained,
    });

    this.notifyListeners();
  }

  // ==========================================================================
  // Boost Management
  // ==========================================================================

  async activateBoost(packageId: string): Promise<{ success: boolean; error?: string }> {
    const pkg = BOOST_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return { success: false, error: 'Invalid boost package' };
    }

    if (this.currentBoost?.isActive) {
      return { success: false, error: 'A boost is already active' };
    }

    try {
      // Call API to purchase and activate
      const response = await api.post<{
        boost_id: string;
        expires_at: string;
      }>('/v1/boosts/activate', {
        package_id: packageId,
      });

      const now = new Date();
      const expiresAt = new Date(response.data!.expires_at);

      this.currentBoost = {
        isActive: true,
        type: pkg.type,
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        remainingMinutes: Math.floor((expiresAt.getTime() - now.getTime()) / 60000),
        viewsGained: 0,
        likesGained: 0,
        matchesGained: 0,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.BOOST_STATUS,
        JSON.stringify(this.currentBoost)
      );

      trackEvent('boost_activated', {
        type: pkg.type,
        duration: pkg.durationMinutes,
        price: pkg.price,
      });

      this.notifyListeners();

      return { success: true };
    } catch (error: any) {
      console.error('[ProfileBoost] Activation failed:', error);
      return { success: false, error: error.message || 'Failed to activate boost' };
    }
  }

  async useFreeBoost(): Promise<{ success: boolean; error?: string }> {
    if (this.freeBoosts <= 0) {
      return { success: false, error: 'No free boosts available' };
    }

    if (this.currentBoost?.isActive) {
      return { success: false, error: 'A boost is already active' };
    }

    try {
      const response = await api.post<{
        boost_id: string;
        expires_at: string;
      }>('/v1/boosts/use-free');

      const now = new Date();
      const expiresAt = new Date(response.data!.expires_at);

      this.currentBoost = {
        isActive: true,
        type: 'standard',
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        remainingMinutes: 30,
        viewsGained: 0,
        likesGained: 0,
        matchesGained: 0,
      };

      this.freeBoosts--;
      await AsyncStorage.setItem(STORAGE_KEYS.FREE_BOOSTS, this.freeBoosts.toString());
      await AsyncStorage.setItem(
        STORAGE_KEYS.BOOST_STATUS,
        JSON.stringify(this.currentBoost)
      );

      trackEvent('free_boost_used', { remaining: this.freeBoosts });

      this.notifyListeners();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to use free boost' };
    }
  }

  async cancelBoost(): Promise<boolean> {
    if (!this.currentBoost) return false;

    try {
      await api.post('/v1/boosts/cancel');

      await this.handleBoostExpired();
      return true;
    } catch (error) {
      console.error('[ProfileBoost] Cancel failed:', error);
      return false;
    }
  }

  // ==========================================================================
  // Stats Update (called from push notifications)
  // ==========================================================================

  updateBoostStats(views?: number, likes?: number, matches?: number): void {
    if (!this.currentBoost) return;

    if (views) this.currentBoost.viewsGained += views;
    if (likes) this.currentBoost.likesGained += likes;
    if (matches) this.currentBoost.matchesGained += matches;

    AsyncStorage.setItem(
      STORAGE_KEYS.BOOST_STATUS,
      JSON.stringify(this.currentBoost)
    ).catch(() => {});

    this.notifyListeners();
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getCurrentBoost(): BoostStatus | null {
    return this.currentBoost ? { ...this.currentBoost } : null;
  }

  isBoostActive(): boolean {
    return this.currentBoost?.isActive || false;
  }

  getBoostType(): BoostType | null {
    return this.currentBoost?.type || null;
  }

  getRemainingMinutes(): number {
    if (!this.currentBoost) return 0;
    const remaining = (new Date(this.currentBoost.expiresAt).getTime() - Date.now()) / 60000;
    return Math.max(0, Math.floor(remaining));
  }

  getFreeBoosts(): number {
    return this.freeBoosts;
  }

  getBoostPackages(): BoostPackage[] {
    return [...BOOST_PACKAGES];
  }

  getBoostHistory(): BoostHistory[] {
    return [...this.boostHistory];
  }

  // ==========================================================================
  // Spotlight
  // ==========================================================================

  async getSpotlightSlots(): Promise<SpotlightSlot[]> {
    try {
      const response = await api.get<{ slots: SpotlightSlot[] }>('/v1/spotlight');
      return response.data!.slots;
    } catch (error) {
      console.error('[ProfileBoost] Failed to get spotlight:', error);
      return [];
    }
  }

  async joinSpotlight(): Promise<{ success: boolean; position?: number; error?: string }> {
    try {
      const response = await api.post<{ position: number }>('/v1/spotlight/join');
      return { success: true, position: response.data!.position };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Listeners
  // ==========================================================================

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  cleanup(): void {
    this.stopExpiryCheck();
  }
}

export const profileBoostService = ProfileBoostService.getInstance();
export default profileBoostService;

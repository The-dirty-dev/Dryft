import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type GiftCategory = 'romantic' | 'fun' | 'sweet' | 'premium' | 'vr_special';

export interface Gift {
  id: string;
  name: string;
  description: string;
  category: GiftCategory;
  imageUrl: string;
  animationUrl?: string;
  price: number;
  currency: string;
  isPremium: boolean;
  isAnimated: boolean;
  isLimited?: boolean;
  availableUntil?: string;
}

export interface SentGift {
  id: string;
  giftId: string;
  giftName: string;
  giftImageUrl: string;
  recipientId: string;
  recipientName: string;
  message?: string;
  sentAt: string;
  isAnonymous: boolean;
  status: 'pending' | 'delivered' | 'viewed' | 'thanked';
}

export interface ReceivedGift {
  id: string;
  giftId: string;
  giftName: string;
  giftImageUrl: string;
  giftAnimationUrl?: string;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  message?: string;
  receivedAt: string;
  isAnonymous: boolean;
  isViewed: boolean;
  isThanked: boolean;
}

export interface GiftPurchase {
  giftId: string;
  quantity: number;
  totalPrice: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  GIFT_INVENTORY: 'dryft_gift_inventory',
  SENT_GIFTS: 'dryft_sent_gifts',
  RECEIVED_GIFTS: 'dryft_received_gifts',
};

// Sample gift catalog
const GIFT_CATALOG: Gift[] = [
  // Romantic
  {
    id: 'gift_rose',
    name: 'Red Rose',
    description: 'A classic romantic gesture',
    category: 'romantic',
    imageUrl: 'https://cdn.dryft.site/gifts/rose.png',
    animationUrl: 'https://cdn.dryft.site/gifts/rose.json',
    price: 0.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: true,
  },
  {
    id: 'gift_heart_box',
    name: 'Heart Box',
    description: 'A box full of hearts',
    category: 'romantic',
    imageUrl: 'https://cdn.dryft.site/gifts/heart_box.png',
    price: 2.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: false,
  },
  {
    id: 'gift_chocolate',
    name: 'Chocolate Box',
    description: 'Sweet treats for your sweet',
    category: 'romantic',
    imageUrl: 'https://cdn.dryft.site/gifts/chocolate.png',
    price: 1.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: false,
  },
  // Fun
  {
    id: 'gift_coffee',
    name: 'Virtual Coffee',
    description: 'Let\'s grab a virtual coffee!',
    category: 'fun',
    imageUrl: 'https://cdn.dryft.site/gifts/coffee.png',
    price: 0.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: false,
  },
  {
    id: 'gift_pizza',
    name: 'Pizza Slice',
    description: 'Because who doesn\'t love pizza?',
    category: 'fun',
    imageUrl: 'https://cdn.dryft.site/gifts/pizza.png',
    price: 0.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: false,
  },
  {
    id: 'gift_puppy',
    name: 'Cute Puppy',
    description: 'An adorable virtual puppy',
    category: 'fun',
    imageUrl: 'https://cdn.dryft.site/gifts/puppy.png',
    animationUrl: 'https://cdn.dryft.site/gifts/puppy.json',
    price: 2.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: true,
  },
  // Sweet
  {
    id: 'gift_cupcake',
    name: 'Cupcake',
    description: 'A sweet little treat',
    category: 'sweet',
    imageUrl: 'https://cdn.dryft.site/gifts/cupcake.png',
    price: 0.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: false,
  },
  {
    id: 'gift_teddy',
    name: 'Teddy Bear',
    description: 'A cuddly friend',
    category: 'sweet',
    imageUrl: 'https://cdn.dryft.site/gifts/teddy.png',
    price: 3.99,
    currency: 'USD',
    isPremium: false,
    isAnimated: false,
  },
  // Premium
  {
    id: 'gift_diamond',
    name: 'Diamond',
    description: 'Shine bright like a diamond',
    category: 'premium',
    imageUrl: 'https://cdn.dryft.site/gifts/diamond.png',
    animationUrl: 'https://cdn.dryft.site/gifts/diamond.json',
    price: 9.99,
    currency: 'USD',
    isPremium: true,
    isAnimated: true,
  },
  {
    id: 'gift_crown',
    name: 'Crown',
    description: 'For someone truly special',
    category: 'premium',
    imageUrl: 'https://cdn.dryft.site/gifts/crown.png',
    animationUrl: 'https://cdn.dryft.site/gifts/crown.json',
    price: 14.99,
    currency: 'USD',
    isPremium: true,
    isAnimated: true,
  },
  // VR Special
  {
    id: 'gift_vr_fireworks',
    name: 'VR Fireworks',
    description: 'Experience fireworks together in VR',
    category: 'vr_special',
    imageUrl: 'https://cdn.dryft.site/gifts/fireworks.png',
    animationUrl: 'https://cdn.dryft.site/gifts/fireworks.json',
    price: 4.99,
    currency: 'USD',
    isPremium: true,
    isAnimated: true,
  },
  {
    id: 'gift_vr_sunset',
    name: 'VR Sunset',
    description: 'Watch a beautiful sunset together',
    category: 'vr_special',
    imageUrl: 'https://cdn.dryft.site/gifts/sunset.png',
    price: 6.99,
    currency: 'USD',
    isPremium: true,
    isAnimated: true,
  },
];

// ============================================================================
// Gift Service
// ============================================================================

class GiftService {
  private static instance: GiftService;
  private inventory: Map<string, number> = new Map();
  private sentGifts: SentGift[] = [];
  private receivedGifts: ReceivedGift[] = [];
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): GiftService {
    if (!GiftService.instance) {
      GiftService.instance = new GiftService();
    }
    return GiftService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadInventory(),
      this.loadSentGifts(),
      this.loadReceivedGifts(),
    ]);

    this.initialized = true;
    console.log('[Gifts] Initialized');
  }

  private async loadInventory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GIFT_INVENTORY);
      if (stored) {
        const data: Record<string, number> = JSON.parse(stored);
        Object.entries(data).forEach(([giftId, count]) => {
          this.inventory.set(giftId, count);
        });
      }
    } catch (error) {
      console.error('[Gifts] Failed to load inventory:', error);
    }
  }

  private async saveInventory(): Promise<void> {
    try {
      const data = Object.fromEntries(this.inventory);
      await AsyncStorage.setItem(STORAGE_KEYS.GIFT_INVENTORY, JSON.stringify(data));
    } catch (error) {
      console.error('[Gifts] Failed to save inventory:', error);
    }
  }

  private async loadSentGifts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SENT_GIFTS);
      if (stored) {
        this.sentGifts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Gifts] Failed to load sent gifts:', error);
    }
  }

  private async saveSentGifts(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SENT_GIFTS,
        JSON.stringify(this.sentGifts)
      );
    } catch (error) {
      console.error('[Gifts] Failed to save sent gifts:', error);
    }
  }

  private async loadReceivedGifts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECEIVED_GIFTS);
      if (stored) {
        this.receivedGifts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Gifts] Failed to load received gifts:', error);
    }
  }

  private async saveReceivedGifts(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECEIVED_GIFTS,
        JSON.stringify(this.receivedGifts)
      );
    } catch (error) {
      console.error('[Gifts] Failed to save received gifts:', error);
    }
  }

  // ==========================================================================
  // Gift Catalog
  // ==========================================================================

  getGiftCatalog(): Gift[] {
    return [...GIFT_CATALOG];
  }

  getGiftsByCategory(category: GiftCategory): Gift[] {
    return GIFT_CATALOG.filter((g) => g.category === category);
  }

  getGift(giftId: string): Gift | null {
    return GIFT_CATALOG.find((g) => g.id === giftId) || null;
  }

  getCategories(): GiftCategory[] {
    return ['romantic', 'fun', 'sweet', 'premium', 'vr_special'];
  }

  getCategoryLabel(category: GiftCategory): string {
    const labels: Record<GiftCategory, string> = {
      romantic: 'Romantic',
      fun: 'Fun',
      sweet: 'Sweet',
      premium: 'Premium',
      vr_special: 'VR Special',
    };
    return labels[category];
  }

  // ==========================================================================
  // Inventory
  // ==========================================================================

  getInventory(): Map<string, number> {
    return new Map(this.inventory);
  }

  getInventoryCount(giftId: string): number {
    return this.inventory.get(giftId) || 0;
  }

  getTotalInventoryCount(): number {
    let total = 0;
    this.inventory.forEach((count) => {
      total += count;
    });
    return total;
  }

  // ==========================================================================
  // Purchase
  // ==========================================================================

  async purchaseGift(giftId: string, quantity: number = 1): Promise<{ success: boolean; error?: string }> {
    const gift = this.getGift(giftId);
    if (!gift) {
      return { success: false, error: 'Gift not found' };
    }

    try {
      await api.post('/v1/gifts/purchase', {
        gift_id: giftId,
        quantity,
      });

      const currentCount = this.inventory.get(giftId) || 0;
      this.inventory.set(giftId, currentCount + quantity);
      await this.saveInventory();

      trackEvent('gift_purchased', {
        gift_id: giftId,
        quantity,
        total_price: gift.price * quantity,
      });

      this.notifyListeners();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Send Gift
  // ==========================================================================

  async sendGift(
    giftId: string,
    recipientId: string,
    recipientName: string,
    options: {
      message?: string;
      isAnonymous?: boolean;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const inventoryCount = this.getInventoryCount(giftId);
    if (inventoryCount <= 0) {
      return { success: false, error: 'You don\'t have this gift in your inventory' };
    }

    const gift = this.getGift(giftId);
    if (!gift) {
      return { success: false, error: 'Gift not found' };
    }

    try {
      const response = await api.post<{ gift_id: string }>('/v1/gifts/send', {
        gift_id: giftId,
        recipient_id: recipientId,
        message: options.message,
        is_anonymous: options.isAnonymous || false,
      });

      // Update inventory
      this.inventory.set(giftId, inventoryCount - 1);
      await this.saveInventory();

      // Add to sent gifts
      const sentGift: SentGift = {
        id: response.data!.gift_id,
        giftId,
        giftName: gift.name,
        giftImageUrl: gift.imageUrl,
        recipientId,
        recipientName,
        message: options.message,
        sentAt: new Date().toISOString(),
        isAnonymous: options.isAnonymous || false,
        status: 'pending',
      };

      this.sentGifts.unshift(sentGift);
      await this.saveSentGifts();

      trackEvent('gift_sent', {
        gift_id: giftId,
        is_anonymous: options.isAnonymous,
        has_message: !!options.message,
      });

      this.notifyListeners();

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Received Gifts
  // ==========================================================================

  addReceivedGift(gift: ReceivedGift): void {
    this.receivedGifts.unshift(gift);
    this.saveReceivedGifts();
    this.notifyListeners();
  }

  async markGiftViewed(giftId: string): Promise<void> {
    const gift = this.receivedGifts.find((g) => g.id === giftId);
    if (gift && !gift.isViewed) {
      gift.isViewed = true;
      await this.saveReceivedGifts();
      this.notifyListeners();

      api.post('/v1/gifts/viewed', { gift_id: giftId }).catch(() => {});
    }
  }

  async sendThankYou(giftId: string, message?: string): Promise<boolean> {
    const gift = this.receivedGifts.find((g) => g.id === giftId);
    if (!gift || gift.isAnonymous) return false;

    try {
      await api.post('/v1/gifts/thank', {
        gift_id: giftId,
        message,
      });

      gift.isThanked = true;
      await this.saveReceivedGifts();
      this.notifyListeners();

      trackEvent('gift_thanked', { gift_id: giftId });

      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getSentGifts(): SentGift[] {
    return [...this.sentGifts];
  }

  getReceivedGifts(): ReceivedGift[] {
    return [...this.receivedGifts];
  }

  getUnviewedGiftsCount(): number {
    return this.receivedGifts.filter((g) => !g.isViewed).length;
  }

  // ==========================================================================
  // Sync
  // ==========================================================================

  async syncWithServer(): Promise<void> {
    try {
      const response = await api.get<{
        inventory: Record<string, number>;
        received_gifts: ReceivedGift[];
      }>('/v1/gifts/sync');

      // Update inventory
      this.inventory.clear();
      Object.entries(response.data!.inventory).forEach(([giftId, count]) => {
        this.inventory.set(giftId, count);
      });
      await this.saveInventory();

      // Merge received gifts
      const existingIds = new Set(this.receivedGifts.map((g) => g.id));
      const newGifts = response.data!.received_gifts.filter(
        (g) => !existingIds.has(g.id)
      );
      this.receivedGifts = [...newGifts, ...this.receivedGifts];
      await this.saveReceivedGifts();

      this.notifyListeners();

      console.log('[Gifts] Synced with server');
    } catch (error) {
      console.error('[Gifts] Sync failed:', error);
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
}

export const giftService = GiftService.getInstance();
export default giftService;

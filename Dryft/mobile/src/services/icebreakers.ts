import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type IcebreakerCategory =
  | 'funny'
  | 'creative'
  | 'deep'
  | 'flirty'
  | 'casual'
  | 'vr_specific'
  | 'interests_based';

export interface Icebreaker {
  id: string;
  text: string;
  category: IcebreakerCategory;
  placeholders?: string[];
  popularity: number;
  isCustom: boolean;
  createdAt?: string;
}

export interface IcebreakerUsage {
  icebreakerId: string;
  recipientId: string;
  usedAt: string;
  gotResponse: boolean;
}

export interface PersonalizedIcebreaker {
  id: string;
  text: string;
  basedOn: string; // What triggered this suggestion
  confidence: number; // 0-1
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  CUSTOM_ICEBREAKERS: 'dryft_custom_icebreakers',
  USAGE_HISTORY: 'dryft_icebreaker_usage',
  FAVORITES: 'dryft_favorite_icebreakers',
};

const ICEBREAKER_TEMPLATES: Icebreaker[] = [
  // Funny
  {
    id: 'funny_1',
    text: "On a scale of 1 to America, how free are you this weekend?",
    category: 'funny',
    popularity: 95,
    isCustom: false,
  },
  {
    id: 'funny_2',
    text: "Do you believe in love at first swipe, or should I unmatch and swipe right again?",
    category: 'funny',
    popularity: 88,
    isCustom: false,
  },
  {
    id: 'funny_3',
    text: "Are you a parking ticket? Because you've got 'fine' written all over you.",
    category: 'funny',
    popularity: 75,
    isCustom: false,
  },
  {
    id: 'funny_4',
    text: "I'd say you're the bomb, but that could turn into a lethal conversation...",
    category: 'funny',
    popularity: 70,
    isCustom: false,
  },
  // Creative
  {
    id: 'creative_1',
    text: "Two truths and a lie: I once {truth1}, I can {truth2}, and I have {lie}. Guess which one is false!",
    category: 'creative',
    placeholders: ['truth1', 'truth2', 'lie'],
    popularity: 92,
    isCustom: false,
  },
  {
    id: 'creative_2',
    text: "If you could have dinner with anyone in history, who would it be and why?",
    category: 'creative',
    popularity: 85,
    isCustom: false,
  },
  {
    id: 'creative_3',
    text: "Quick, you're stranded on a desert island - what three things do you bring?",
    category: 'creative',
    popularity: 80,
    isCustom: false,
  },
  // Deep
  {
    id: 'deep_1',
    text: "What's something you've always wanted to try but haven't had the courage to yet?",
    category: 'deep',
    popularity: 88,
    isCustom: false,
  },
  {
    id: 'deep_2',
    text: "If you could master any skill instantly, what would it be?",
    category: 'deep',
    popularity: 85,
    isCustom: false,
  },
  {
    id: 'deep_3',
    text: "What's the best piece of advice you've ever received?",
    category: 'deep',
    popularity: 82,
    isCustom: false,
  },
  // Flirty
  {
    id: 'flirty_1',
    text: "I was going to send a pickup line, but then I thought you deserve better. So... hi! I'm {name}.",
    category: 'flirty',
    placeholders: ['name'],
    popularity: 90,
    isCustom: false,
  },
  {
    id: 'flirty_2',
    text: "Your smile in your photos is contagious - I've been smiling ever since I saw your profile.",
    category: 'flirty',
    popularity: 85,
    isCustom: false,
  },
  {
    id: 'flirty_3',
    text: "I'm not a photographer, but I can definitely picture us together.",
    category: 'flirty',
    popularity: 78,
    isCustom: false,
  },
  // Casual
  {
    id: 'casual_1',
    text: "Hey! I noticed you're into {interest}. What got you into that?",
    category: 'casual',
    placeholders: ['interest'],
    popularity: 92,
    isCustom: false,
  },
  {
    id: 'casual_2',
    text: "What's the best thing that happened to you today?",
    category: 'casual',
    popularity: 88,
    isCustom: false,
  },
  {
    id: 'casual_3',
    text: "Coffee or tea? This is very important for our future compatibility.",
    category: 'casual',
    popularity: 85,
    isCustom: false,
  },
  // VR Specific
  {
    id: 'vr_1',
    text: "Ready to explore virtual worlds together? I know a great virtual beach we could visit.",
    category: 'vr_specific',
    popularity: 90,
    isCustom: false,
  },
  {
    id: 'vr_2',
    text: "What's your favorite VR experience so far? I'd love to try it with you!",
    category: 'vr_specific',
    popularity: 88,
    isCustom: false,
  },
  {
    id: 'vr_3',
    text: "They say VR is the future of dating. Want to be pioneers together?",
    category: 'vr_specific',
    popularity: 85,
    isCustom: false,
  },
  {
    id: 'vr_4',
    text: "In VR, we can go anywhere. Where would you want our first virtual date to be?",
    category: 'vr_specific',
    popularity: 92,
    isCustom: false,
  },
  // Interests Based
  {
    id: 'interest_music',
    text: "I see you're into {music_genre}! What's the last concert you went to?",
    category: 'interests_based',
    placeholders: ['music_genre'],
    popularity: 90,
    isCustom: false,
  },
  {
    id: 'interest_travel',
    text: "Your travel photos are amazing! What's the most underrated place you've visited?",
    category: 'interests_based',
    popularity: 88,
    isCustom: false,
  },
  {
    id: 'interest_food',
    text: "Fellow foodie! What's your go-to comfort food?",
    category: 'interests_based',
    popularity: 85,
    isCustom: false,
  },
];

// ============================================================================
// Icebreakers Service
// ============================================================================

class IcebreakersService {
  private static instance: IcebreakersService;
  private customIcebreakers: Icebreaker[] = [];
  private usageHistory: IcebreakerUsage[] = [];
  private favorites: Set<string> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): IcebreakersService {
    if (!IcebreakersService.instance) {
      IcebreakersService.instance = new IcebreakersService();
    }
    return IcebreakersService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadCustomIcebreakers(),
      this.loadUsageHistory(),
      this.loadFavorites(),
    ]);

    this.initialized = true;
    console.log('[Icebreakers] Initialized');
  }

  private async loadCustomIcebreakers(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_ICEBREAKERS);
      if (stored) {
        this.customIcebreakers = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Icebreakers] Failed to load custom:', error);
    }
  }

  private async saveCustomIcebreakers(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CUSTOM_ICEBREAKERS,
        JSON.stringify(this.customIcebreakers)
      );
    } catch (error) {
      console.error('[Icebreakers] Failed to save custom:', error);
    }
  }

  private async loadUsageHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.USAGE_HISTORY);
      if (stored) {
        this.usageHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Icebreakers] Failed to load usage:', error);
    }
  }

  private async saveUsageHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USAGE_HISTORY,
        JSON.stringify(this.usageHistory)
      );
    } catch (error) {
      console.error('[Icebreakers] Failed to save usage:', error);
    }
  }

  private async loadFavorites(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (stored) {
        this.favorites = new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[Icebreakers] Failed to load favorites:', error);
    }
  }

  private async saveFavorites(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.FAVORITES,
        JSON.stringify(Array.from(this.favorites))
      );
    } catch (error) {
      console.error('[Icebreakers] Failed to save favorites:', error);
    }
  }

  // ==========================================================================
  // Get Icebreakers
  // ==========================================================================

  getAllIcebreakers(): Icebreaker[] {
    return [...ICEBREAKER_TEMPLATES, ...this.customIcebreakers];
  }

  getByCategory(category: IcebreakerCategory): Icebreaker[] {
    return this.getAllIcebreakers()
      .filter((i) => i.category === category)
      .sort((a, b) => b.popularity - a.popularity);
  }

  getCategories(): IcebreakerCategory[] {
    return ['funny', 'creative', 'deep', 'flirty', 'casual', 'vr_specific', 'interests_based'];
  }

  getCategoryLabel(category: IcebreakerCategory): string {
    const labels: Record<IcebreakerCategory, string> = {
      funny: 'Funny',
      creative: 'Creative',
      deep: 'Deep & Meaningful',
      flirty: 'Flirty',
      casual: 'Casual',
      vr_specific: 'VR Dates',
      interests_based: 'Based on Interests',
    };
    return labels[category];
  }

  getCategoryEmoji(category: IcebreakerCategory): string {
    const emojis: Record<IcebreakerCategory, string> = {
      funny: '😂',
      creative: '🎨',
      deep: '💭',
      flirty: '😘',
      casual: '👋',
      vr_specific: '🥽',
      interests_based: '⭐',
    };
    return emojis[category];
  }

  // ==========================================================================
  // Personalized Suggestions
  // ==========================================================================

  getPersonalizedSuggestions(
    recipientProfile: {
      name: string;
      interests?: string[];
      bio?: string;
      photos?: { description?: string }[];
    }
  ): PersonalizedIcebreaker[] {
    const suggestions: PersonalizedIcebreaker[] = [];

    // Based on interests
    if (recipientProfile.interests?.length) {
      const interest = recipientProfile.interests[0];
      const template = ICEBREAKER_TEMPLATES.find(
        (i) => i.id === 'casual_1' || i.category === 'interests_based'
      );

      if (template) {
        suggestions.push({
          id: `personalized_interest_${Date.now()}`,
          text: template.text.replace('{interest}', interest),
          basedOn: `Their interest in ${interest}`,
          confidence: 0.9,
        });
      }
    }

    // Always include a VR-specific opener
    const vrTemplate = ICEBREAKER_TEMPLATES.find((i) => i.id === 'vr_4');
    if (vrTemplate) {
      suggestions.push({
        id: `personalized_vr_${Date.now()}`,
        text: vrTemplate.text,
        basedOn: 'VR dating experience',
        confidence: 0.85,
      });
    }

    // Include a casual opener with their name
    suggestions.push({
      id: `personalized_name_${Date.now()}`,
      text: `Hey ${recipientProfile.name}! Your profile caught my eye. What's the story behind your first photo?`,
      basedOn: 'Their profile photos',
      confidence: 0.8,
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // ==========================================================================
  // Custom Icebreakers
  // ==========================================================================

  async createCustom(text: string, category: IcebreakerCategory): Promise<Icebreaker> {
    const icebreaker: Icebreaker = {
      id: `custom_${Date.now()}`,
      text,
      category,
      popularity: 50,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    this.customIcebreakers.push(icebreaker);
    await this.saveCustomIcebreakers();

    trackEvent('icebreaker_created', { category });

    return icebreaker;
  }

  async deleteCustom(icebreakerId: string): Promise<boolean> {
    const index = this.customIcebreakers.findIndex((i) => i.id === icebreakerId);
    if (index === -1) return false;

    this.customIcebreakers.splice(index, 1);
    await this.saveCustomIcebreakers();

    return true;
  }

  getCustomIcebreakers(): Icebreaker[] {
    return [...this.customIcebreakers];
  }

  // ==========================================================================
  // Favorites
  // ==========================================================================

  async addToFavorites(icebreakerId: string): Promise<void> {
    this.favorites.add(icebreakerId);
    await this.saveFavorites();
  }

  async removeFromFavorites(icebreakerId: string): Promise<void> {
    this.favorites.delete(icebreakerId);
    await this.saveFavorites();
  }

  isFavorite(icebreakerId: string): boolean {
    return this.favorites.has(icebreakerId);
  }

  getFavorites(): Icebreaker[] {
    return this.getAllIcebreakers().filter((i) => this.favorites.has(i.id));
  }

  // ==========================================================================
  // Usage Tracking
  // ==========================================================================

  async recordUsage(icebreakerId: string, recipientId: string): Promise<void> {
    const usage: IcebreakerUsage = {
      icebreakerId,
      recipientId,
      usedAt: new Date().toISOString(),
      gotResponse: false,
    };

    this.usageHistory.push(usage);
    await this.saveUsageHistory();

    trackEvent('icebreaker_used', { icebreaker_id: icebreakerId });
  }

  async markGotResponse(recipientId: string): Promise<void> {
    const usage = this.usageHistory.find(
      (u) => u.recipientId === recipientId && !u.gotResponse
    );

    if (usage) {
      usage.gotResponse = true;
      await this.saveUsageHistory();

      trackEvent('icebreaker_got_response', {
        icebreaker_id: usage.icebreakerId,
      });
    }
  }

  getUsageStats(): { total: number; gotResponses: number; responseRate: number } {
    const total = this.usageHistory.length;
    const gotResponses = this.usageHistory.filter((u) => u.gotResponse).length;
    const responseRate = total > 0 ? gotResponses / total : 0;

    return { total, gotResponses, responseRate };
  }

  wasUsedWithRecipient(icebreakerId: string, recipientId: string): boolean {
    return this.usageHistory.some(
      (u) => u.icebreakerId === icebreakerId && u.recipientId === recipientId
    );
  }

  // ==========================================================================
  // Fill Placeholders
  // ==========================================================================

  fillPlaceholders(
    icebreaker: Icebreaker,
    values: Record<string, string>
  ): string {
    let text = icebreaker.text;
    Object.entries(values).forEach(([key, value]) => {
      text = text.replace(`{${key}}`, value);
    });
    return text;
  }

  // ==========================================================================
  // Random Selection
  // ==========================================================================

  getRandomIcebreaker(excludeIds?: string[]): Icebreaker {
    const available = this.getAllIcebreakers().filter(
      (i) => !excludeIds?.includes(i.id)
    );

    if (available.length === 0) {
      return ICEBREAKER_TEMPLATES[0];
    }

    // Weight by popularity
    const totalWeight = available.reduce((sum, i) => sum + i.popularity, 0);
    let random = Math.random() * totalWeight;

    for (const icebreaker of available) {
      random -= icebreaker.popularity;
      if (random <= 0) {
        return icebreaker;
      }
    }

    return available[0];
  }
}

export const icebreakersService = IcebreakersService.getInstance();
export default icebreakersService;

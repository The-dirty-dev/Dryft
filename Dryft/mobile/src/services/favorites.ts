import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { trackEvent } from './analytics';
import { DARK_THEME_COLORS } from '../theme/ThemeProvider';

// ============================================================================
// Types
// ============================================================================

export interface FavoriteProfile {
  id: string;
  userId: string;
  userName: string;
  userAge: number;
  userPhoto: string;
  userLocation?: string;
  note?: string;
  tags: string[];
  savedAt: string;
  lastSeen?: string;
  isOnline?: boolean;
  isMatched?: boolean;
}

export interface FavoriteCollection {
  id: string;
  name: string;
  emoji?: string;
  color: string;
  profileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type FavoriteSortOption = 'recent' | 'name' | 'age' | 'distance';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  FAVORITES: 'dryft_favorites',
  COLLECTIONS: 'dryft_favorite_collections',
};

const MAX_FAVORITES = 100;
const MAX_COLLECTIONS = 10;

const DEFAULT_COLORS = [
  DARK_THEME_COLORS.error,
  DARK_THEME_COLORS.warning,
  DARK_THEME_COLORS.success,
  DARK_THEME_COLORS.info,
  DARK_THEME_COLORS.accent,
  DARK_THEME_COLORS.accentPink,
  DARK_THEME_COLORS.primaryLight,
  DARK_THEME_COLORS.accentSecondary,
];

// ============================================================================
// Favorites Service
// ============================================================================

class FavoritesService {
  private static instance: FavoritesService;
  private favorites: Map<string, FavoriteProfile> = new Map();
  private collections: Map<string, FavoriteCollection> = new Map();
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): FavoritesService {
    if (!FavoritesService.instance) {
      FavoritesService.instance = new FavoritesService();
    }
    return FavoritesService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadFavorites(),
      this.loadCollections(),
    ]);

    this.initialized = true;
    console.log('[Favorites] Initialized');
  }

  private async loadFavorites(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (stored) {
        const favorites: FavoriteProfile[] = JSON.parse(stored);
        favorites.forEach((f) => this.favorites.set(f.userId, f));
      }
    } catch (error) {
      console.error('[Favorites] Failed to load:', error);
    }
  }

  private async saveFavorites(): Promise<void> {
    try {
      const favorites = Array.from(this.favorites.values());
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch (error) {
      console.error('[Favorites] Failed to save:', error);
    }
  }

  private async loadCollections(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTIONS);
      if (stored) {
        const collections: FavoriteCollection[] = JSON.parse(stored);
        collections.forEach((c) => this.collections.set(c.id, c));
      }
    } catch (error) {
      console.error('[Favorites] Failed to load collections:', error);
    }
  }

  private async saveCollections(): Promise<void> {
    try {
      const collections = Array.from(this.collections.values());
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
    } catch (error) {
      console.error('[Favorites] Failed to save collections:', error);
    }
  }

  // ==========================================================================
  // Favorites Management
  // ==========================================================================

  async addFavorite(profile: Omit<FavoriteProfile, 'id' | 'savedAt' | 'tags'>): Promise<boolean> {
    if (this.favorites.size >= MAX_FAVORITES) {
      console.warn('[Favorites] Maximum favorites reached');
      return false;
    }

    if (this.favorites.has(profile.userId)) {
      return true; // Already favorited
    }

    const favorite: FavoriteProfile = {
      ...profile,
      id: `fav_${Date.now()}`,
      tags: [],
      savedAt: new Date().toISOString(),
    };

    this.favorites.set(profile.userId, favorite);
    await this.saveFavorites();
    this.notifyListeners();

    // Sync with server
    api.post('/v1/favorites', { user_id: profile.userId }).catch(() => {});

    trackEvent('profile_favorited', {
      user_id: profile.userId,
      total_favorites: this.favorites.size,
    });

    return true;
  }

  async removeFavorite(userId: string): Promise<boolean> {
    if (!this.favorites.has(userId)) {
      return false;
    }

    this.favorites.delete(userId);
    await this.saveFavorites();

    // Remove from all collections
    for (const collection of this.collections.values()) {
      const index = collection.profileIds.indexOf(userId);
      if (index !== -1) {
        collection.profileIds.splice(index, 1);
      }
    }
    await this.saveCollections();

    this.notifyListeners();

    // Sync with server
    api.delete(`/v1/favorites/${userId}`).catch(() => {});

    trackEvent('profile_unfavorited', { user_id: userId });

    return true;
  }

  isFavorite(userId: string): boolean {
    return this.favorites.has(userId);
  }

  getFavorite(userId: string): FavoriteProfile | null {
    return this.favorites.get(userId) || null;
  }

  getFavorites(sortBy: FavoriteSortOption = 'recent'): FavoriteProfile[] {
    const favorites = Array.from(this.favorites.values());

    switch (sortBy) {
      case 'name':
        return favorites.sort((a, b) => a.userName.localeCompare(b.userName));
      case 'age':
        return favorites.sort((a, b) => a.userAge - b.userAge);
      case 'recent':
      default:
        return favorites.sort((a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
    }
  }

  getFavoritesCount(): number {
    return this.favorites.size;
  }

  // ==========================================================================
  // Notes & Tags
  // ==========================================================================

  async updateNote(userId: string, note: string): Promise<boolean> {
    const favorite = this.favorites.get(userId);
    if (!favorite) return false;

    favorite.note = note;
    await this.saveFavorites();
    this.notifyListeners();

    return true;
  }

  async addTag(userId: string, tag: string): Promise<boolean> {
    const favorite = this.favorites.get(userId);
    if (!favorite) return false;

    if (!favorite.tags.includes(tag)) {
      favorite.tags.push(tag);
      await this.saveFavorites();
      this.notifyListeners();
    }

    return true;
  }

  async removeTag(userId: string, tag: string): Promise<boolean> {
    const favorite = this.favorites.get(userId);
    if (!favorite) return false;

    const index = favorite.tags.indexOf(tag);
    if (index !== -1) {
      favorite.tags.splice(index, 1);
      await this.saveFavorites();
      this.notifyListeners();
    }

    return true;
  }

  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const favorite of this.favorites.values()) {
      favorite.tags.forEach((tag) => tags.add(tag));
    }
    return Array.from(tags);
  }

  getFavoritesByTag(tag: string): FavoriteProfile[] {
    return Array.from(this.favorites.values()).filter((f) =>
      f.tags.includes(tag)
    );
  }

  // ==========================================================================
  // Collections
  // ==========================================================================

  async createCollection(name: string, emoji?: string): Promise<FavoriteCollection | null> {
    if (this.collections.size >= MAX_COLLECTIONS) {
      console.warn('[Favorites] Maximum collections reached');
      return null;
    }

    const usedColors = Array.from(this.collections.values()).map((c) => c.color);
    const availableColor = DEFAULT_COLORS.find((c) => !usedColors.includes(c)) || DEFAULT_COLORS[0];

    const collection: FavoriteCollection = {
      id: `col_${Date.now()}`,
      name,
      emoji,
      color: availableColor,
      profileIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.collections.set(collection.id, collection);
    await this.saveCollections();
    this.notifyListeners();

    trackEvent('favorite_collection_created', { name });

    return collection;
  }

  async updateCollection(
    collectionId: string,
    updates: Partial<Pick<FavoriteCollection, 'name' | 'emoji' | 'color'>>
  ): Promise<boolean> {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    Object.assign(collection, updates, { updatedAt: new Date().toISOString() });
    await this.saveCollections();
    this.notifyListeners();

    return true;
  }

  async deleteCollection(collectionId: string): Promise<boolean> {
    if (!this.collections.has(collectionId)) return false;

    this.collections.delete(collectionId);
    await this.saveCollections();
    this.notifyListeners();

    return true;
  }

  async addToCollection(collectionId: string, userId: string): Promise<boolean> {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    if (!collection.profileIds.includes(userId)) {
      collection.profileIds.push(userId);
      collection.updatedAt = new Date().toISOString();
      await this.saveCollections();
      this.notifyListeners();
    }

    return true;
  }

  async removeFromCollection(collectionId: string, userId: string): Promise<boolean> {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    const index = collection.profileIds.indexOf(userId);
    if (index !== -1) {
      collection.profileIds.splice(index, 1);
      collection.updatedAt = new Date().toISOString();
      await this.saveCollections();
      this.notifyListeners();
    }

    return true;
  }

  getCollections(): FavoriteCollection[] {
    return Array.from(this.collections.values()).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getCollection(collectionId: string): FavoriteCollection | null {
    return this.collections.get(collectionId) || null;
  }

  getCollectionProfiles(collectionId: string): FavoriteProfile[] {
    const collection = this.collections.get(collectionId);
    if (!collection) return [];

    return collection.profileIds
      .map((id) => this.favorites.get(id))
      .filter((f): f is FavoriteProfile => f !== undefined);
  }

  getProfileCollections(userId: string): FavoriteCollection[] {
    return Array.from(this.collections.values()).filter((c) =>
      c.profileIds.includes(userId)
    );
  }

  // ==========================================================================
  // Sync
  // ==========================================================================

  async syncWithServer(): Promise<void> {
    try {
      const response = await api.get<{
        favorites: FavoriteProfile[];
        collections: FavoriteCollection[];
      }>('/v1/favorites/sync');

      // Merge server data with local
      response.data!.favorites.forEach((f) => {
        if (!this.favorites.has(f.userId)) {
          this.favorites.set(f.userId, f);
        }
      });

      await this.saveFavorites();
      this.notifyListeners();

      console.log('[Favorites] Synced with server');
    } catch (error) {
      console.error('[Favorites] Sync failed:', error);
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
  // Limits
  // ==========================================================================

  getMaxFavorites(): number {
    return MAX_FAVORITES;
  }

  getMaxCollections(): number {
    return MAX_COLLECTIONS;
  }

  getRemainingFavoritesSlots(): number {
    return MAX_FAVORITES - this.favorites.size;
  }
}

export const favoritesService = FavoritesService.getInstance();
export default favoritesService;

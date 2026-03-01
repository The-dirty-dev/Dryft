import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  favoritesService,
  FavoriteProfile,
  FavoriteCollection,
  FavoriteSortOption,
} from '../services/favorites';

// ============================================================================
// useFavorites - Main favorites hook
// ============================================================================

/**
 * React hook `useFavorites`.
 * @param sortBy - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useFavorites(sortBy);
 */
export function useFavorites(sortBy: FavoriteSortOption = 'recent') {
  const [favorites, setFavorites] = useState<FavoriteProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await favoritesService.initialize();
      setFavorites(favoritesService.getFavorites(sortBy));
      setIsLoading(false);
    };

    load();

    const unsubscribe = favoritesService.subscribe(() => {
      setFavorites(favoritesService.getFavorites(sortBy));
    });

    return unsubscribe;
  }, [sortBy]);

  const addFavorite = useCallback(
    async (profile: Omit<FavoriteProfile, 'id' | 'savedAt' | 'tags'>) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return favoritesService.addFavorite(profile);
    },
    []
  );

  const removeFavorite = useCallback(async (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return favoritesService.removeFavorite(userId);
  }, []);

  const isFavorite = useCallback((userId: string) => {
    return favoritesService.isFavorite(userId);
  }, [favorites]);

  const toggleFavorite = useCallback(
    async (profile: Omit<FavoriteProfile, 'id' | 'savedAt' | 'tags'>) => {
      if (favoritesService.isFavorite(profile.userId)) {
        return removeFavorite(profile.userId);
      } else {
        return addFavorite(profile);
      }
    },
    [addFavorite, removeFavorite]
  );

  const count = favorites.length;
  const maxFavorites = favoritesService.getMaxFavorites();
  const remainingSlots = favoritesService.getRemainingFavoritesSlots();

  return {
    favorites,
    count,
    maxFavorites,
    remainingSlots,
    isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
}

// ============================================================================
// useFavoriteProfile - Single favorite profile hook
// ============================================================================

/**
 * React hook `useFavoriteProfile`.
 * @param userId - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useFavoriteProfile(userId);
 */
export function useFavoriteProfile(userId: string) {
  const [favorite, setFavorite] = useState<FavoriteProfile | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    const load = async () => {
      await favoritesService.initialize();
      setFavorite(favoritesService.getFavorite(userId));
      setIsFavorited(favoritesService.isFavorite(userId));
    };

    load();

    const unsubscribe = favoritesService.subscribe(() => {
      setFavorite(favoritesService.getFavorite(userId));
      setIsFavorited(favoritesService.isFavorite(userId));
    });

    return unsubscribe;
  }, [userId]);

  const updateNote = useCallback(
    async (note: string) => {
      return favoritesService.updateNote(userId, note);
    },
    [userId]
  );

  const addTag = useCallback(
    async (tag: string) => {
      return favoritesService.addTag(userId, tag);
    },
    [userId]
  );

  const removeTag = useCallback(
    async (tag: string) => {
      return favoritesService.removeTag(userId, tag);
    },
    [userId]
  );

  const collections = useMemo(() => {
    return favoritesService.getProfileCollections(userId);
  }, [userId, favorite]);

  return {
    favorite,
    isFavorited,
    note: favorite?.note,
    tags: favorite?.tags || [],
    collections,
    updateNote,
    addTag,
    removeTag,
  };
}

// ============================================================================
// useFavoriteCollections - Collections management
// ============================================================================

/**
 * React hook `useFavoriteCollections`.
 * @returns Hook state and actions.
 * @example
 * const value = useFavoriteCollections();
 */
export function useFavoriteCollections() {
  const [collections, setCollections] = useState<FavoriteCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await favoritesService.initialize();
      setCollections(favoritesService.getCollections());
      setIsLoading(false);
    };

    load();

    const unsubscribe = favoritesService.subscribe(() => {
      setCollections(favoritesService.getCollections());
    });

    return unsubscribe;
  }, []);

  const createCollection = useCallback(async (name: string, emoji?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return favoritesService.createCollection(name, emoji);
  }, []);

  const updateCollection = useCallback(
    async (
      collectionId: string,
      updates: Partial<Pick<FavoriteCollection, 'name' | 'emoji' | 'color'>>
    ) => {
      return favoritesService.updateCollection(collectionId, updates);
    },
    []
  );

  const deleteCollection = useCallback(async (collectionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return favoritesService.deleteCollection(collectionId);
  }, []);

  const addToCollection = useCallback(
    async (collectionId: string, userId: string) => {
      return favoritesService.addToCollection(collectionId, userId);
    },
    []
  );

  const removeFromCollection = useCallback(
    async (collectionId: string, userId: string) => {
      return favoritesService.removeFromCollection(collectionId, userId);
    },
    []
  );

  const getCollectionProfiles = useCallback((collectionId: string) => {
    return favoritesService.getCollectionProfiles(collectionId);
  }, [collections]);

  const maxCollections = favoritesService.getMaxCollections();

  return {
    collections,
    isLoading,
    maxCollections,
    canCreateMore: collections.length < maxCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    getCollectionProfiles,
  };
}

// ============================================================================
// useFavoriteTags - Tags management
// ============================================================================

/**
 * React hook `useFavoriteTags`.
 * @returns Hook state and actions.
 * @example
 * const value = useFavoriteTags();
 */
export function useFavoriteTags() {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      await favoritesService.initialize();
      setTags(favoritesService.getAllTags());
    };

    load();

    const unsubscribe = favoritesService.subscribe(() => {
      setTags(favoritesService.getAllTags());
    });

    return unsubscribe;
  }, []);

  const getFavoritesByTag = useCallback((tag: string) => {
    return favoritesService.getFavoritesByTag(tag);
  }, []);

  return {
    tags,
    getFavoritesByTag,
  };
}

// ============================================================================
// useFavoriteButton - For use in profile cards
// ============================================================================

export function useFavoriteButton(
  userId: string,
  userName: string,
  userAge: number,
  userPhoto: string,
  userLocation?: string
) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      await favoritesService.initialize();
      setIsFavorited(favoritesService.isFavorite(userId));
    };

    load();

    const unsubscribe = favoritesService.subscribe(() => {
      setIsFavorited(favoritesService.isFavorite(userId));
    });

    return unsubscribe;
  }, [userId]);

  const toggle = useCallback(async () => {
    setIsLoading(true);

    if (isFavorited) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await favoritesService.removeFavorite(userId);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await favoritesService.addFavorite({
        userId,
        userName,
        userAge,
        userPhoto,
        userLocation,
      });
    }

    setIsLoading(false);
  }, [isFavorited, userId, userName, userAge, userPhoto, userLocation]);

  return {
    isFavorited,
    isLoading,
    toggle,
  };
}

export default useFavorites;

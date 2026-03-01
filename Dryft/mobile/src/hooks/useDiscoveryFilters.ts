import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  discoveryFiltersService,
  DiscoveryFilters,
  FilterPreset,
  FilterStats,
  DEFAULT_FILTERS,
  Gender,
  RelationshipGoal,
  SortOption,
} from '../services/discoveryFilters';

// ============================================================================
// useDiscoveryFilters - Main filters hook
// ============================================================================

/**
 * React hook `useDiscoveryFilters`.
 * @returns Hook state and actions.
 * @example
 * const value = useDiscoveryFilters();
 */
export function useDiscoveryFilters() {
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const load = async () => {
      await discoveryFiltersService.initialize();
      setFilters(discoveryFiltersService.getFilters());
      setIsLoading(false);
    };

    load();

    const unsubscribe = discoveryFiltersService.subscribe(() => {
      setFilters(discoveryFiltersService.getFilters());
    });

    return unsubscribe;
  }, []);

  const updateFilters = useCallback(async (updates: Partial<DiscoveryFilters>) => {
    await discoveryFiltersService.updateFilters(updates);
    setIsDirty(false);
  }, []);

  const resetFilters = useCallback(async () => {
    await discoveryFiltersService.resetFilters();
    setIsDirty(false);
  }, []);

  const setLocalFilters = useCallback((updates: Partial<DiscoveryFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const applyLocalFilters = useCallback(async () => {
    await discoveryFiltersService.updateFilters(filters);
    setIsDirty(false);
  }, [filters]);

  const activeFilterCount = useMemo(
    () => discoveryFiltersService.getActiveFilterCount(),
    [filters]
  );

  return {
    filters,
    isLoading,
    isDirty,
    activeFilterCount,
    updateFilters,
    resetFilters,
    setLocalFilters,
    applyLocalFilters,
  };
}

// ============================================================================
// useFilterPresets - Filter presets management
// ============================================================================

/**
 * React hook `useFilterPresets`.
 * @returns Hook state and actions.
 * @example
 * const value = useFilterPresets();
 */
export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await discoveryFiltersService.initialize();
      setPresets(discoveryFiltersService.getPresets());
      setIsLoading(false);
    };

    load();
  }, []);

  const createPreset = useCallback(async (name: string) => {
    const preset = await discoveryFiltersService.createPreset(name);
    setPresets(discoveryFiltersService.getPresets());
    return preset;
  }, []);

  const applyPreset = useCallback(async (presetId: string) => {
    const success = await discoveryFiltersService.applyPreset(presetId);
    return success;
  }, []);

  const deletePreset = useCallback(async (presetId: string) => {
    const success = await discoveryFiltersService.deletePreset(presetId);
    if (success) {
      setPresets(discoveryFiltersService.getPresets());
    }
    return success;
  }, []);

  return {
    presets,
    isLoading,
    createPreset,
    applyPreset,
    deletePreset,
  };
}

// ============================================================================
// useFilterStats - Get matching profile count
// ============================================================================

/**
 * React hook `useFilterStats`.
 * @returns Hook state and actions.
 * @example
 * const value = useFilterStats();
 */
export function useFilterStats() {
  const [stats, setStats] = useState<FilterStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    const result = await discoveryFiltersService.getFilterStats();
    setStats(result);
    setIsLoading(false);
  }, []);

  return {
    stats,
    isLoading,
    fetchStats,
  };
}

// ============================================================================
// Individual Filter Hooks
// ============================================================================

/**
 * React hook `useAgeRangeFilter`.
 * @returns Hook state and actions.
 * @example
 * const value = useAgeRangeFilter();
 */
export function useAgeRangeFilter() {
  const { filters, updateFilters } = useDiscoveryFilters();

  const setAgeRange = useCallback(
    async (min: number, max: number) => {
      await updateFilters({ ageRange: [min, max] });
    },
    [updateFilters]
  );

  return {
    ageRange: filters.ageRange,
    setAgeRange,
  };
}

/**
 * React hook `useDistanceFilter`.
 * @returns Hook state and actions.
 * @example
 * const value = useDistanceFilter();
 */
export function useDistanceFilter() {
  const { filters, updateFilters } = useDiscoveryFilters();

  const setDistance = useCallback(
    async (distance: number) => {
      await updateFilters({ distance });
    },
    [updateFilters]
  );

  const setDistanceUnit = useCallback(
    async (unit: 'km' | 'mi') => {
      await updateFilters({ distanceUnit: unit });
    },
    [updateFilters]
  );

  return {
    distance: filters.distance,
    distanceUnit: filters.distanceUnit,
    setDistance,
    setDistanceUnit,
  };
}

/**
 * React hook `useGenderFilter`.
 * @returns Hook state and actions.
 * @example
 * const value = useGenderFilter();
 */
export function useGenderFilter() {
  const { filters, updateFilters } = useDiscoveryFilters();

  const setGenderPreference = useCallback(
    async (genders: Gender[]) => {
      await updateFilters({ genderPreference: genders });
    },
    [updateFilters]
  );

  const toggleGender = useCallback(
    async (gender: Gender) => {
      const current = filters.genderPreference;
      const updated = current.includes(gender)
        ? current.filter((g) => g !== gender)
        : [...current, gender];
      await updateFilters({ genderPreference: updated });
    },
    [filters.genderPreference, updateFilters]
  );

  return {
    genderPreference: filters.genderPreference,
    setGenderPreference,
    toggleGender,
  };
}

/**
 * React hook `useInterestsFilter`.
 * @returns Hook state and actions.
 * @example
 * const value = useInterestsFilter();
 */
export function useInterestsFilter() {
  const { filters, updateFilters } = useDiscoveryFilters();

  const setInterests = useCallback(
    async (interests: string[]) => {
      await updateFilters({ interests });
    },
    [updateFilters]
  );

  const toggleInterest = useCallback(
    async (interest: string) => {
      const current = filters.interests;
      const updated = current.includes(interest)
        ? current.filter((i) => i !== interest)
        : [...current, interest];
      await updateFilters({ interests: updated });
    },
    [filters.interests, updateFilters]
  );

  return {
    interests: filters.interests,
    setInterests,
    toggleInterest,
  };
}

/**
 * React hook `useSortFilter`.
 * @returns Hook state and actions.
 * @example
 * const value = useSortFilter();
 */
export function useSortFilter() {
  const { filters, updateFilters } = useDiscoveryFilters();

  const setSortBy = useCallback(
    async (sortBy: SortOption) => {
      await updateFilters({ sortBy });
    },
    [updateFilters]
  );

  return {
    sortBy: filters.sortBy,
    setSortBy,
  };
}

export default useDiscoveryFilters;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type Gender = 'male' | 'female' | 'non_binary' | 'other';
export type RelationshipGoal = 'casual' | 'dating' | 'relationship' | 'marriage' | 'friendship' | 'unsure';
export type VerificationStatus = 'any' | 'verified_only';
export type ActivityStatus = 'any' | 'recently_active' | 'online_now';
export type SortOption = 'distance' | 'recently_active' | 'newest' | 'compatibility';

export interface DiscoveryFilters {
  // Demographics
  ageRange: [number, number];
  distance: number;
  distanceUnit: 'km' | 'mi';
  genderPreference: Gender[];

  // Lifestyle
  height: [number, number] | null;
  heightUnit: 'cm' | 'ft';

  // Relationship
  relationshipGoals: RelationshipGoal[];
  hasChildren: 'any' | 'yes' | 'no';
  wantsChildren: 'any' | 'yes' | 'no' | 'maybe';

  // Lifestyle Habits
  smoking: 'any' | 'never' | 'sometimes' | 'regularly';
  drinking: 'any' | 'never' | 'socially' | 'regularly';
  exercise: 'any' | 'never' | 'sometimes' | 'regularly';

  // Interests & Compatibility
  interests: string[];
  languages: string[];
  education: 'any' | 'high_school' | 'bachelors' | 'masters' | 'doctorate';

  // Profile Quality
  verificationStatus: VerificationStatus;
  activityStatus: ActivityStatus;
  hasPhotos: number; // Minimum photos
  hasBio: boolean;

  // VR Specific
  vrExperience: 'any' | 'beginner' | 'intermediate' | 'expert';
  vrHeadset: string[];

  // Advanced
  hideProfiles: string[]; // Hidden profile IDs
  dealbreakers: string[];

  // Sorting
  sortBy: SortOption;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: Partial<DiscoveryFilters>;
  isDefault: boolean;
  createdAt: string;
}

export interface FilterStats {
  matchingProfiles: number;
  totalProfiles: number;
  lastUpdated: string;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  FILTERS: 'dryft_discovery_filters',
  PRESETS: 'dryft_filter_presets',
};

export const DEFAULT_FILTERS: DiscoveryFilters = {
  ageRange: [18, 50],
  distance: 50,
  distanceUnit: 'mi',
  genderPreference: [],
  height: null,
  heightUnit: 'ft',
  relationshipGoals: [],
  hasChildren: 'any',
  wantsChildren: 'any',
  smoking: 'any',
  drinking: 'any',
  exercise: 'any',
  interests: [],
  languages: [],
  education: 'any',
  verificationStatus: 'any',
  activityStatus: 'any',
  hasPhotos: 1,
  hasBio: false,
  vrExperience: 'any',
  vrHeadset: [],
  hideProfiles: [],
  dealbreakers: [],
  sortBy: 'distance',
};

export const INTERESTS_LIST = [
  'Music', 'Movies', 'Travel', 'Fitness', 'Gaming', 'Reading', 'Cooking',
  'Art', 'Photography', 'Sports', 'Nature', 'Technology', 'Fashion',
  'Dancing', 'Yoga', 'Meditation', 'Hiking', 'Swimming', 'Running',
  'Cycling', 'Coffee', 'Wine', 'Food', 'Pets', 'Volunteering',
];

export const VR_HEADSETS = [
  'Meta Quest 3',
  'Meta Quest Pro',
  'Apple Vision Pro',
  'PlayStation VR2',
  'Valve Index',
  'HTC Vive',
  'Pico 4',
  'Other',
];

export const LANGUAGES_LIST = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian',
  'Dutch', 'Swedish', 'Polish', 'Turkish',
];

// ============================================================================
// Discovery Filters Service
// ============================================================================

class DiscoveryFiltersService {
  private static instance: DiscoveryFiltersService;
  private filters: DiscoveryFilters = { ...DEFAULT_FILTERS };
  private presets: FilterPreset[] = [];
  private initialized = false;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): DiscoveryFiltersService {
    if (!DiscoveryFiltersService.instance) {
      DiscoveryFiltersService.instance = new DiscoveryFiltersService();
    }
    return DiscoveryFiltersService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadFilters(),
      this.loadPresets(),
    ]);

    this.initialized = true;
    console.log('[DiscoveryFilters] Initialized');
  }

  private async loadFilters(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.FILTERS);
      if (stored) {
        this.filters = { ...DEFAULT_FILTERS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[DiscoveryFilters] Failed to load filters:', error);
    }
  }

  private async saveFilters(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(this.filters));
    } catch (error) {
      console.error('[DiscoveryFilters] Failed to save filters:', error);
    }
  }

  private async loadPresets(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PRESETS);
      if (stored) {
        this.presets = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[DiscoveryFilters] Failed to load presets:', error);
    }
  }

  private async savePresets(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(this.presets));
    } catch (error) {
      console.error('[DiscoveryFilters] Failed to save presets:', error);
    }
  }

  // ==========================================================================
  // Filter Management
  // ==========================================================================

  getFilters(): DiscoveryFilters {
    return { ...this.filters };
  }

  async updateFilters(updates: Partial<DiscoveryFilters>): Promise<void> {
    this.filters = { ...this.filters, ...updates };
    await this.saveFilters();
    this.notifyListeners();

    trackEvent('discovery_filters_updated', {
      updated_fields: Object.keys(updates),
    });
  }

  async resetFilters(): Promise<void> {
    this.filters = { ...DEFAULT_FILTERS };
    await this.saveFilters();
    this.notifyListeners();

    trackEvent('discovery_filters_reset');
  }

  // ==========================================================================
  // Individual Filter Updates
  // ==========================================================================

  async setAgeRange(min: number, max: number): Promise<void> {
    await this.updateFilters({ ageRange: [Math.max(18, min), Math.min(99, max)] });
  }

  async setDistance(distance: number): Promise<void> {
    await this.updateFilters({ distance: Math.max(1, Math.min(500, distance)) });
  }

  async setGenderPreference(genders: Gender[]): Promise<void> {
    await this.updateFilters({ genderPreference: genders });
  }

  async setRelationshipGoals(goals: RelationshipGoal[]): Promise<void> {
    await this.updateFilters({ relationshipGoals: goals });
  }

  async setInterests(interests: string[]): Promise<void> {
    await this.updateFilters({ interests });
  }

  async setSortBy(sortBy: SortOption): Promise<void> {
    await this.updateFilters({ sortBy });
  }

  // ==========================================================================
  // Presets
  // ==========================================================================

  getPresets(): FilterPreset[] {
    return [...this.presets];
  }

  async createPreset(name: string, filters?: Partial<DiscoveryFilters>): Promise<FilterPreset> {
    const preset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name,
      filters: filters || { ...this.filters },
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    this.presets.push(preset);
    await this.savePresets();

    trackEvent('filter_preset_created', { name });

    return preset;
  }

  async applyPreset(presetId: string): Promise<boolean> {
    const preset = this.presets.find((p) => p.id === presetId);
    if (!preset) return false;

    await this.updateFilters(preset.filters);

    trackEvent('filter_preset_applied', { preset_name: preset.name });

    return true;
  }

  async deletePreset(presetId: string): Promise<boolean> {
    const index = this.presets.findIndex((p) => p.id === presetId);
    if (index === -1) return false;

    this.presets.splice(index, 1);
    await this.savePresets();

    return true;
  }

  // ==========================================================================
  // Filter Stats
  // ==========================================================================

  async getFilterStats(): Promise<FilterStats> {
    try {
      const response = await api.post<FilterStats>('/v1/discovery/filter-stats', {
        filters: this.filters,
      });
      return response.data;
    } catch (error) {
      console.error('[DiscoveryFilters] Failed to get stats:', error);
      return {
        matchingProfiles: 0,
        totalProfiles: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // ==========================================================================
  // Hidden Profiles
  // ==========================================================================

  async hideProfile(profileId: string): Promise<void> {
    if (!this.filters.hideProfiles.includes(profileId)) {
      this.filters.hideProfiles.push(profileId);
      await this.saveFilters();
    }
  }

  async unhideProfile(profileId: string): Promise<void> {
    this.filters.hideProfiles = this.filters.hideProfiles.filter((id) => id !== profileId);
    await this.saveFilters();
  }

  isProfileHidden(profileId: string): boolean {
    return this.filters.hideProfiles.includes(profileId);
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  validateFilters(filters: Partial<DiscoveryFilters>): string[] {
    const errors: string[] = [];

    if (filters.ageRange) {
      const [min, max] = filters.ageRange;
      if (min < 18) errors.push('Minimum age must be 18 or older');
      if (max < min) errors.push('Maximum age must be greater than minimum');
    }

    if (filters.distance !== undefined && filters.distance < 1) {
      errors.push('Distance must be at least 1');
    }

    if (filters.hasPhotos !== undefined && filters.hasPhotos < 0) {
      errors.push('Photo count must be positive');
    }

    return errors;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getActiveFilterCount(): number {
    let count = 0;
    const defaults = DEFAULT_FILTERS;

    if (this.filters.ageRange[0] !== defaults.ageRange[0] ||
        this.filters.ageRange[1] !== defaults.ageRange[1]) count++;
    if (this.filters.distance !== defaults.distance) count++;
    if (this.filters.genderPreference.length > 0) count++;
    if (this.filters.relationshipGoals.length > 0) count++;
    if (this.filters.interests.length > 0) count++;
    if (this.filters.verificationStatus !== 'any') count++;
    if (this.filters.activityStatus !== 'any') count++;
    if (this.filters.smoking !== 'any') count++;
    if (this.filters.drinking !== 'any') count++;
    if (this.filters.hasBio) count++;

    return count;
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

export const discoveryFiltersService = DiscoveryFiltersService.getInstance();
export default discoveryFiltersService;

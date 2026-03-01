import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapProfile {
  id: string;
  userId: string;
  name: string;
  age: number;
  photo: string;
  coordinates: Coordinates;
  distance: number;
  isOnline: boolean;
  isVerified: boolean;
  lastActive?: string;
  approximateLocation?: boolean;
}

export interface MapCluster {
  id: string;
  coordinates: Coordinates;
  count: number;
  profiles: MapProfile[];
}

export interface PlaceOfInterest {
  id: string;
  name: string;
  type: 'cafe' | 'bar' | 'restaurant' | 'park' | 'venue' | 'landmark';
  coordinates: Coordinates;
  address: string;
  rating?: number;
  photo?: string;
  isPopular: boolean;
}

export interface MapFilters {
  maxDistance: number;
  onlineOnly: boolean;
  verifiedOnly: boolean;
  ageRange: [number, number];
  showPlaces: boolean;
}

export type MapStyle = 'standard' | 'dark' | 'satellite';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  MAP_FILTERS: 'dryft_map_filters',
  MAP_STYLE: 'dryft_map_style',
  LAST_LOCATION: 'dryft_last_location',
};

const DEFAULT_FILTERS: MapFilters = {
  maxDistance: 50,
  onlineOnly: false,
  verifiedOnly: false,
  ageRange: [18, 50],
  showPlaces: true,
};

const DEFAULT_REGION: MapRegion = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

const CLUSTER_RADIUS = 50; // pixels

// ============================================================================
// Map View Service
// ============================================================================

class MapViewService {
  private static instance: MapViewService;
  private currentLocation: Coordinates | null = null;
  private filters: MapFilters = DEFAULT_FILTERS;
  private mapStyle: MapStyle = 'dark';
  private locationPermission: boolean = false;
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): MapViewService {
    if (!MapViewService.instance) {
      MapViewService.instance = new MapViewService();
    }
    return MapViewService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadFilters(),
      this.loadMapStyle(),
      this.loadLastLocation(),
    ]);

    this.initialized = true;
    console.log('[MapView] Initialized');
  }

  private async loadFilters(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MAP_FILTERS);
      if (stored) {
        this.filters = { ...DEFAULT_FILTERS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[MapView] Failed to load filters:', error);
    }
  }

  private async saveFilters(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MAP_FILTERS, JSON.stringify(this.filters));
    } catch (error) {
      console.error('[MapView] Failed to save filters:', error);
    }
  }

  private async loadMapStyle(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MAP_STYLE);
      if (stored) {
        this.mapStyle = stored as MapStyle;
      }
    } catch (error) {
      console.error('[MapView] Failed to load map style:', error);
    }
  }

  private async loadLastLocation(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
      if (stored) {
        this.currentLocation = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[MapView] Failed to load last location:', error);
    }
  }

  // ==========================================================================
  // Location
  // ==========================================================================

  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.locationPermission = status === 'granted';
      return this.locationPermission;
    } catch (error) {
      console.error('[MapView] Permission request failed:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<Coordinates | null> {
    if (!this.locationPermission) {
      const granted = await this.requestLocationPermission();
      if (!granted) return null;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_LOCATION,
        JSON.stringify(this.currentLocation)
      );

      return this.currentLocation;
    } catch (error) {
      console.error('[MapView] Failed to get location:', error);
      return this.currentLocation;
    }
  }

  getLastKnownLocation(): Coordinates | null {
    return this.currentLocation;
  }

  // ==========================================================================
  // Profiles on Map
  // ==========================================================================

  async getProfilesInRegion(region: MapRegion): Promise<MapProfile[]> {
    try {
      const response = await api.post<{ profiles: MapProfile[] }>(
        '/v1/map/profiles',
        {
          latitude: region.latitude,
          longitude: region.longitude,
          lat_delta: region.latitudeDelta,
          lng_delta: region.longitudeDelta,
          filters: this.filters,
        }
      );

      return response.data!.profiles;
    } catch (error) {
      console.error('[MapView] Failed to get profiles:', error);
      return [];
    }
  }

  clusterProfiles(
    profiles: MapProfile[],
    region: MapRegion,
    mapWidth: number
  ): (MapProfile | MapCluster)[] {
    const clusters: Map<string, MapProfile[]> = new Map();
    const pixelsPerDegree = mapWidth / region.longitudeDelta;
    const clusterSizeDegrees = CLUSTER_RADIUS / pixelsPerDegree;

    profiles.forEach((profile) => {
      const gridX = Math.floor(profile.coordinates.longitude / clusterSizeDegrees);
      const gridY = Math.floor(profile.coordinates.latitude / clusterSizeDegrees);
      const key = `${gridX}_${gridY}`;

      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key)!.push(profile);
    });

    const result: (MapProfile | MapCluster)[] = [];

    clusters.forEach((clusterProfiles) => {
      if (clusterProfiles.length === 1) {
        result.push(clusterProfiles[0]);
      } else {
        // Calculate cluster center
        const avgLat =
          clusterProfiles.reduce((sum, p) => sum + p.coordinates.latitude, 0) /
          clusterProfiles.length;
        const avgLng =
          clusterProfiles.reduce((sum, p) => sum + p.coordinates.longitude, 0) /
          clusterProfiles.length;

        result.push({
          id: `cluster_${avgLat}_${avgLng}`,
          coordinates: { latitude: avgLat, longitude: avgLng },
          count: clusterProfiles.length,
          profiles: clusterProfiles,
        });
      }
    });

    return result;
  }

  // ==========================================================================
  // Places of Interest
  // ==========================================================================

  async getPlacesOfInterest(region: MapRegion): Promise<PlaceOfInterest[]> {
    if (!this.filters.showPlaces) return [];

    try {
      const response = await api.get<{ places: PlaceOfInterest[] }>(
        '/v1/map/places',
        {
          params: {
            latitude: region.latitude,
            longitude: region.longitude,
            lat_delta: region.latitudeDelta,
            lng_delta: region.longitudeDelta,
          },
        }
      );

      return response.data!.places;
    } catch (error) {
      console.error('[MapView] Failed to get places:', error);
      return [];
    }
  }

  getPlaceTypeIcon(type: PlaceOfInterest['type']): string {
    const icons: Record<PlaceOfInterest['type'], string> = {
      cafe: 'cafe',
      bar: 'beer',
      restaurant: 'restaurant',
      park: 'leaf',
      venue: 'musical-notes',
      landmark: 'flag',
    };
    return icons[type];
  }

  // ==========================================================================
  // Filters
  // ==========================================================================

  getFilters(): MapFilters {
    return { ...this.filters };
  }

  async updateFilters(updates: Partial<MapFilters>): Promise<void> {
    this.filters = { ...this.filters, ...updates };
    await this.saveFilters();

    trackEvent('map_filters_updated', updates);

    this.notifyListeners();
  }

  async resetFilters(): Promise<void> {
    this.filters = { ...DEFAULT_FILTERS };
    await this.saveFilters();
    this.notifyListeners();
  }

  // ==========================================================================
  // Map Style
  // ==========================================================================

  getMapStyle(): MapStyle {
    return this.mapStyle;
  }

  async setMapStyle(style: MapStyle): Promise<void> {
    this.mapStyle = style;
    await AsyncStorage.setItem(STORAGE_KEYS.MAP_STYLE, style);
    this.notifyListeners();
  }

  getMapStyleConfig(style: MapStyle): any {
    // Return map style configurations for different providers
    switch (style) {
      case 'dark':
        return [
          { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8B5CF6' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
        ];
      case 'satellite':
        return null; // Use default satellite style
      case 'standard':
      default:
        return null; // Use default style
    }
  }

  // ==========================================================================
  // Distance Calculations
  // ==========================================================================

  calculateDistance(from: Coordinates, to: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(to.latitude - from.latitude);
    const dLon = this.toRad(to.longitude - from.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(from.latitude)) *
        Math.cos(this.toRad(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  formatDistance(km: number, unit: 'km' | 'mi' = 'mi'): string {
    if (unit === 'mi') {
      const miles = km * 0.621371;
      if (miles < 1) return '< 1 mi';
      return `${Math.round(miles)} mi`;
    } else {
      if (km < 1) return '< 1 km';
      return `${Math.round(km)} km`;
    }
  }

  // ==========================================================================
  // Region Helpers
  // ==========================================================================

  getDefaultRegion(): MapRegion {
    if (this.currentLocation) {
      return {
        ...this.currentLocation,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    return DEFAULT_REGION;
  }

  regionContainsCoordinate(region: MapRegion, coord: Coordinates): boolean {
    const latMin = region.latitude - region.latitudeDelta / 2;
    const latMax = region.latitude + region.latitudeDelta / 2;
    const lngMin = region.longitude - region.longitudeDelta / 2;
    const lngMax = region.longitude + region.longitudeDelta / 2;

    return (
      coord.latitude >= latMin &&
      coord.latitude <= latMax &&
      coord.longitude >= lngMin &&
      coord.longitude <= lngMax
    );
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

export const mapViewService = MapViewService.getInstance();
export default mapViewService;

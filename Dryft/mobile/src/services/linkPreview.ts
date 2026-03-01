import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

// ============================================================================
// Types
// ============================================================================

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  type?: 'article' | 'video' | 'image' | 'website' | 'profile';
  videoUrl?: string;
  author?: string;
  publishedDate?: string;
}

export interface LinkDetectionResult {
  hasLinks: boolean;
  links: string[];
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY_PREFIX = 'dryft_link_preview_';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// URL patterns for special handling
const SPECIAL_DOMAINS: Record<string, { type: string; parser: (url: string) => Partial<LinkPreviewData> }> = {
  'youtube.com': {
    type: 'video',
    parser: (url) => {
      const videoId = url.match(/(?:v=|\/embed\/|\/watch\?v=)([a-zA-Z0-9_-]{11})/)?.[1];
      return {
        type: 'video',
        siteName: 'YouTube',
        image: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined,
      };
    },
  },
  'youtu.be': {
    type: 'video',
    parser: (url) => {
      const videoId = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1];
      return {
        type: 'video',
        siteName: 'YouTube',
        image: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined,
      };
    },
  },
  'instagram.com': {
    type: 'profile',
    parser: () => ({
      type: 'profile',
      siteName: 'Instagram',
    }),
  },
  'twitter.com': {
    type: 'profile',
    parser: () => ({
      type: 'profile',
      siteName: 'Twitter',
    }),
  },
  'x.com': {
    type: 'profile',
    parser: () => ({
      type: 'profile',
      siteName: 'X',
    }),
  },
  'spotify.com': {
    type: 'website',
    parser: () => ({
      siteName: 'Spotify',
    }),
  },
  'open.spotify.com': {
    type: 'website',
    parser: () => ({
      siteName: 'Spotify',
    }),
  },
};

// ============================================================================
// Link Preview Service
// ============================================================================

class LinkPreviewService {
  private static instance: LinkPreviewService;
  private cache: Map<string, { data: LinkPreviewData; timestamp: number }> = new Map();
  private pendingRequests: Map<string, Promise<LinkPreviewData | null>> = new Map();

  private constructor() {
    this.loadCache();
  }

  static getInstance(): LinkPreviewService {
    if (!LinkPreviewService.instance) {
      LinkPreviewService.instance = new LinkPreviewService();
    }
    return LinkPreviewService.instance;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  private async loadCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));

      if (cacheKeys.length === 0) return;

      const entries = await AsyncStorage.multiGet(cacheKeys);
      const now = Date.now();

      for (const [key, value] of entries) {
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (now - parsed.timestamp < CACHE_EXPIRY) {
              const url = key.replace(CACHE_KEY_PREFIX, '');
              this.cache.set(url, parsed);
            } else {
              // Remove expired cache
              await AsyncStorage.removeItem(key);
            }
          } catch {
            // Invalid cache entry
          }
        }
      }
    } catch (error) {
      console.error('[LinkPreview] Failed to load cache:', error);
    }
  }

  private async saveToCache(url: string, data: LinkPreviewData): Promise<void> {
    const cacheEntry = { data, timestamp: Date.now() };
    this.cache.set(url, cacheEntry);

    try {
      await AsyncStorage.setItem(
        `${CACHE_KEY_PREFIX}${url}`,
        JSON.stringify(cacheEntry)
      );
    } catch (error) {
      console.error('[LinkPreview] Failed to save to cache:', error);
    }
  }

  private getFromCache(url: string): LinkPreviewData | null {
    const entry = this.cache.get(url);
    if (entry && Date.now() - entry.timestamp < CACHE_EXPIRY) {
      return entry.data;
    }
    return null;
  }

  // ==========================================================================
  // Link Detection
  // ==========================================================================

  detectLinks(text: string): LinkDetectionResult {
    // URL regex pattern
    const urlPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

    const matches = text.match(urlPattern);
    const links = matches ? [...new Set(matches)] : [];

    return {
      hasLinks: links.length > 0,
      links,
    };
  }

  // ==========================================================================
  // Link Preview Fetching
  // ==========================================================================

  async getPreview(url: string): Promise<LinkPreviewData | null> {
    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);

    // Check cache first
    const cached = this.getFromCache(normalizedUrl);
    if (cached) {
      return cached;
    }

    // Check for pending request
    const pending = this.pendingRequests.get(normalizedUrl);
    if (pending) {
      return pending;
    }

    // Create new request
    const request = this.fetchPreview(normalizedUrl);
    this.pendingRequests.set(normalizedUrl, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(normalizedUrl);
    }
  }

  private async fetchPreview(url: string): Promise<LinkPreviewData | null> {
    try {
      // Check for special domain handling
      const specialData = this.getSpecialDomainData(url);

      // Fetch from server
      const response = await api.get<{
        title?: string;
        description?: string;
        image?: string;
        site_name?: string;
        favicon?: string;
        type?: string;
        author?: string;
        published_date?: string;
      }>('/v1/utils/link-preview', {
        params: { url },
      });

      const data: LinkPreviewData = {
        url,
        title: response.data!.title,
        description: response.data!.description,
        image: response.data!.image,
        siteName: response.data!.site_name || specialData?.siteName,
        favicon: response.data!.favicon,
        type: (response.data!.type as LinkPreviewData['type']) || specialData?.type,
        author: response.data!.author,
        publishedDate: response.data!.published_date,
        ...specialData,
      };

      // Save to cache
      await this.saveToCache(url, data);

      return data;
    } catch (error) {
      console.error('[LinkPreview] Fetch failed:', error);

      // Try to return special domain data even if fetch fails
      const specialData = this.getSpecialDomainData(url);
      if (specialData) {
        const data: LinkPreviewData = {
          url,
          ...specialData,
        };
        await this.saveToCache(url, data);
        return data;
      }

      return null;
    }
  }

  private getSpecialDomainData(url: string): Partial<LinkPreviewData> | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');

      for (const [domain, config] of Object.entries(SPECIAL_DOMAINS)) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return config.parser(url);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // URL Processing
  // ==========================================================================

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove tracking parameters
      const cleanParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid'];
      cleanParams.forEach((param) => urlObj.searchParams.delete(param));
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  getDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Batch Processing
  // ==========================================================================

  async getPreviewsForLinks(urls: string[]): Promise<Map<string, LinkPreviewData | null>> {
    const results = new Map<string, LinkPreviewData | null>();
    const uniqueUrls = [...new Set(urls)];

    const promises = uniqueUrls.map(async (url) => {
      const preview = await this.getPreview(url);
      results.set(url, preview);
    });

    await Promise.all(promises);
    return results;
  }

  // ==========================================================================
  // Cache Control
  // ==========================================================================

  async clearCache(): Promise<void> {
    this.cache.clear();

    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('[LinkPreview] Failed to clear cache:', error);
    }
  }

  async removeFromCache(url: string): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url);
    this.cache.delete(normalizedUrl);

    try {
      await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${normalizedUrl}`);
    } catch (error) {
      console.error('[LinkPreview] Failed to remove from cache:', error);
    }
  }
}

export const linkPreviewService = LinkPreviewService.getInstance();
export default linkPreviewService;

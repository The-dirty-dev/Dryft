import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { api } from './api';
import { trackEvent } from './analytics';
import { DARK_THEME_COLORS } from '../theme/ThemeProvider';

// ============================================================================
// Types
// ============================================================================

export type StoryMediaType = 'image' | 'video' | 'text';
export type StoryPrivacy = 'everyone' | 'matches_only' | 'close_friends';

export interface StoryMedia {
  type: StoryMediaType;
  uri: string;
  remoteUrl?: string;
  thumbnailUrl?: string;
  duration?: number; // For video
  text?: string;
  textStyle?: StoryTextStyle;
  backgroundColor?: string;
}

export interface StoryTextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  alignment: 'left' | 'center' | 'right';
  backgroundColor?: string;
}

export interface StorySticker {
  id: string;
  type: 'emoji' | 'gif' | 'poll' | 'question' | 'location' | 'mention' | 'music';
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  data: Record<string, any>;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  media: StoryMedia;
  stickers: StorySticker[];
  privacy: StoryPrivacy;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  expiresAt: string;
  isViewed: boolean;
  isLiked: boolean;
}

export interface StoryView {
  viewerId: string;
  viewerName: string;
  viewerPhoto: string;
  viewedAt: string;
  liked: boolean;
  replied: boolean;
}

export interface StoryGroup {
  userId: string;
  userName: string;
  userPhoto: string;
  stories: Story[];
  hasUnviewed: boolean;
  lastUpdated: string;
}

export interface MyStoryStats {
  totalViews: number;
  uniqueViewers: number;
  likes: number;
  replies: number;
  topViewers: StoryView[];
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  MY_STORIES: 'dryft_my_stories',
  VIEWED_STORIES: 'dryft_viewed_stories',
  STORY_DRAFTS: 'dryft_story_drafts',
};

const STORY_DURATION_HOURS = 24;
const MAX_STORY_VIDEO_SECONDS = 15;
const STORY_IMAGE_SIZE = 1080;

const TEXT_STYLES: StoryTextStyle[] = [
  { fontFamily: 'System', fontSize: 32, color: DARK_THEME_COLORS.text, alignment: 'center' },
  {
    fontFamily: 'System',
    fontSize: 28,
    color: DARK_THEME_COLORS.textInverse,
    alignment: 'center',
    backgroundColor: DARK_THEME_COLORS.text,
  },
  { fontFamily: 'System', fontSize: 36, color: DARK_THEME_COLORS.safetyWarning, alignment: 'center' },
  { fontFamily: 'System', fontSize: 24, color: DARK_THEME_COLORS.text, alignment: 'left' },
];

const BACKGROUND_COLORS = [
  DARK_THEME_COLORS.accent,
  DARK_THEME_COLORS.accentPink,
  DARK_THEME_COLORS.error,
  DARK_THEME_COLORS.warning,
  DARK_THEME_COLORS.success,
  DARK_THEME_COLORS.info,
  DARK_THEME_COLORS.accentSecondary,
  DARK_THEME_COLORS.primaryLight,
  DARK_THEME_COLORS.backgroundDarkest,
  DARK_THEME_COLORS.surface,
];

// ============================================================================
// Stories Service
// ============================================================================

class StoriesService {
  private static instance: StoriesService;
  private myStories: Story[] = [];
  private viewedStoryIds: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  private constructor() {}

  static getInstance(): StoriesService {
    if (!StoriesService.instance) {
      StoriesService.instance = new StoriesService();
    }
    return StoriesService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.loadMyStories(),
      this.loadViewedStories(),
    ]);

    // Clean up expired stories
    this.cleanupExpiredStories();

    this.initialized = true;
    console.log('[Stories] Initialized');
  }

  private async loadMyStories(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MY_STORIES);
      if (stored) {
        this.myStories = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Stories] Failed to load my stories:', error);
    }
  }

  private async saveMyStories(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MY_STORIES, JSON.stringify(this.myStories));
    } catch (error) {
      console.error('[Stories] Failed to save my stories:', error);
    }
  }

  private async loadViewedStories(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.VIEWED_STORIES);
      if (stored) {
        this.viewedStoryIds = new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[Stories] Failed to load viewed stories:', error);
    }
  }

  private async saveViewedStories(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.VIEWED_STORIES,
        JSON.stringify(Array.from(this.viewedStoryIds))
      );
    } catch (error) {
      console.error('[Stories] Failed to save viewed stories:', error);
    }
  }

  private cleanupExpiredStories(): void {
    const now = new Date();
    this.myStories = this.myStories.filter(
      (story) => new Date(story.expiresAt) > now
    );
    this.saveMyStories();
  }

  // ==========================================================================
  // Story Creation
  // ==========================================================================

  async pickImageForStory(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return null;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });

      if (result.canceled) return null;

      // Process image
      const processed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: STORY_IMAGE_SIZE } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      return processed.uri;
    } catch (error) {
      console.error('[Stories] Failed to pick image:', error);
      return null;
    }
  }

  async takePhotoForStory(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return null;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });

      if (result.canceled) return null;

      const processed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: STORY_IMAGE_SIZE } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      return processed.uri;
    } catch (error) {
      console.error('[Stories] Failed to take photo:', error);
      return null;
    }
  }

  async createStory(
    media: StoryMedia,
    options: {
      stickers?: StorySticker[];
      privacy?: StoryPrivacy;
    } = {}
  ): Promise<Story | null> {
    try {
      // Upload media
      let remoteUrl: string | undefined;
      let thumbnailUrl: string | undefined;

      if (media.type !== 'text') {
        const base64 = await FileSystem.readAsStringAsync(media.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const uploadResponse = await api.post<{
          url: string;
          thumbnail_url: string;
        }>('/v1/stories/upload', {
          media_type: media.type,
          media_data: base64,
        });

        remoteUrl = uploadResponse.data.url;
        thumbnailUrl = uploadResponse.data.thumbnail_url;
      }

      // Create story
      const now = new Date();
      const expiresAt = new Date(now.getTime() + STORY_DURATION_HOURS * 60 * 60 * 1000);

      const response = await api.post<{ story: Story }>('/v1/stories', {
        media: {
          ...media,
          remoteUrl,
          thumbnailUrl,
        },
        stickers: options.stickers || [],
        privacy: options.privacy || 'everyone',
        expires_at: expiresAt.toISOString(),
      });

      const story = response.data!.story;

      // Add to local storage
      this.myStories.unshift(story);
      await this.saveMyStories();

      trackEvent('story_created', {
        media_type: media.type,
        privacy: options.privacy,
        sticker_count: options.stickers?.length || 0,
      });

      this.notifyListeners();

      return story;
    } catch (error) {
      console.error('[Stories] Failed to create story:', error);
      return null;
    }
  }

  async deleteStory(storyId: string): Promise<boolean> {
    try {
      await api.delete(`/v1/stories/${storyId}`);

      this.myStories = this.myStories.filter((s) => s.id !== storyId);
      await this.saveMyStories();

      trackEvent('story_deleted');

      this.notifyListeners();

      return true;
    } catch (error) {
      console.error('[Stories] Failed to delete story:', error);
      return false;
    }
  }

  // ==========================================================================
  // Story Viewing
  // ==========================================================================

  async getStoryFeed(): Promise<StoryGroup[]> {
    try {
      const response = await api.get<{ groups: StoryGroup[] }>('/v1/stories/feed');

      // Mark viewed status
      response.data!.groups.forEach((group) => {
        group.stories.forEach((story) => {
          story.isViewed = this.viewedStoryIds.has(story.id);
        });
        group.hasUnviewed = group.stories.some((s) => !s.isViewed);
      });

      // Sort: unviewed first, then by last updated
      return response.data!.groups.sort((a, b) => {
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      });
    } catch (error) {
      console.error('[Stories] Failed to get feed:', error);
      return [];
    }
  }

  async markStoryViewed(storyId: string): Promise<void> {
    if (this.viewedStoryIds.has(storyId)) return;

    this.viewedStoryIds.add(storyId);
    await this.saveViewedStories();

    // Report to server
    api.post('/v1/stories/view', { story_id: storyId }).catch(() => {});

    trackEvent('story_viewed', { story_id: storyId });
  }

  async likeStory(storyId: string): Promise<boolean> {
    try {
      await api.post('/v1/stories/like', { story_id: storyId });

      trackEvent('story_liked', { story_id: storyId });

      return true;
    } catch (error) {
      return false;
    }
  }

  async replyToStory(storyId: string, message: string): Promise<boolean> {
    try {
      await api.post('/v1/stories/reply', {
        story_id: storyId,
        message,
      });

      trackEvent('story_replied', { story_id: storyId });

      return true;
    } catch (error) {
      return false;
    }
  }

  // ==========================================================================
  // My Stories
  // ==========================================================================

  getMyStories(): Story[] {
    this.cleanupExpiredStories();
    return [...this.myStories];
  }

  hasActiveStory(): boolean {
    this.cleanupExpiredStories();
    return this.myStories.length > 0;
  }

  async getStoryViewers(storyId: string): Promise<StoryView[]> {
    try {
      const response = await api.get<{ viewers: StoryView[] }>(
        `/v1/stories/${storyId}/viewers`
      );
      return response.data!.viewers;
    } catch (error) {
      return [];
    }
  }

  async getMyStoryStats(): Promise<MyStoryStats> {
    try {
      const response = await api.get<MyStoryStats>('/v1/stories/my/stats');
      return response.data;
    } catch (error) {
      return {
        totalViews: 0,
        uniqueViewers: 0,
        likes: 0,
        replies: 0,
        topViewers: [],
      };
    }
  }

  // ==========================================================================
  // Text Styles & Backgrounds
  // ==========================================================================

  getTextStyles(): StoryTextStyle[] {
    return [...TEXT_STYLES];
  }

  getBackgroundColors(): string[] {
    return [...BACKGROUND_COLORS];
  }

  // ==========================================================================
  // Stickers
  // ==========================================================================

  createPollSticker(question: string, options: string[]): StorySticker {
    return {
      id: `sticker_poll_${Date.now()}`,
      type: 'poll',
      position: { x: 0.5, y: 0.5 },
      scale: 1,
      rotation: 0,
      data: { question, options, votes: {} },
    };
  }

  createQuestionSticker(question: string): StorySticker {
    return {
      id: `sticker_question_${Date.now()}`,
      type: 'question',
      position: { x: 0.5, y: 0.7 },
      scale: 1,
      rotation: 0,
      data: { question },
    };
  }

  createLocationSticker(location: string): StorySticker {
    return {
      id: `sticker_location_${Date.now()}`,
      type: 'location',
      position: { x: 0.5, y: 0.1 },
      scale: 1,
      rotation: 0,
      data: { location },
    };
  }

  createMentionSticker(userId: string, userName: string): StorySticker {
    return {
      id: `sticker_mention_${Date.now()}`,
      type: 'mention',
      position: { x: 0.5, y: 0.5 },
      scale: 1,
      rotation: 0,
      data: { userId, userName },
    };
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
  // Constants
  // ==========================================================================

  getMaxVideoDuration(): number {
    return MAX_STORY_VIDEO_SECONDS;
  }

  getStoryDurationHours(): number {
    return STORY_DURATION_HOURS;
  }
}

export const storiesService = StoriesService.getInstance();
export default storiesService;

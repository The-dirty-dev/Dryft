import * as QuickActions from 'expo-quick-actions';
import { Platform } from 'react-native';
import { trackEvent } from './analytics';

// ============================================================================
// Types
// ============================================================================

export type QuickActionType =
  | 'new_match'
  | 'view_matches'
  | 'start_vr'
  | 'edit_profile'
  | 'view_likes'
  | 'open_chat';

export interface QuickActionItem {
  id: QuickActionType;
  title: string;
  subtitle?: string;
  icon: string;
  params?: Record<string, string>;
}

export interface QuickActionData {
  type: QuickActionType;
  params?: Record<string, string>;
}

type QuickActionHandler = (action: QuickActionData) => void | Promise<void>;

// ============================================================================
// Constants
// ============================================================================

const STATIC_ACTIONS: QuickActionItem[] = [
  {
    id: 'new_match',
    title: 'Find Matches',
    subtitle: 'Start swiping',
    icon: Platform.select({
      ios: 'symbol:heart.fill',
      android: 'shortcut_heart',
    }) || 'heart',
  },
  {
    id: 'view_matches',
    title: 'My Matches',
    subtitle: 'See your connections',
    icon: Platform.select({
      ios: 'symbol:message.fill',
      android: 'shortcut_chat',
    }) || 'chat',
  },
  {
    id: 'start_vr',
    title: 'Start VR Date',
    subtitle: 'Virtual reality',
    icon: Platform.select({
      ios: 'symbol:visionpro',
      android: 'shortcut_vr',
    }) || 'vr',
  },
  {
    id: 'edit_profile',
    title: 'Edit Profile',
    subtitle: 'Update your info',
    icon: Platform.select({
      ios: 'symbol:person.crop.circle',
      android: 'shortcut_profile',
    }) || 'profile',
  },
];

// ============================================================================
// Quick Actions Service
// ============================================================================

class QuickActionsService {
  private static instance: QuickActionsService;
  private handler: QuickActionHandler | null = null;
  private pendingAction: QuickActionData | null = null;
  private isReady = false;
  private subscription: { remove: () => void } | null = null;

  private constructor() {}

  static getInstance(): QuickActionsService {
    if (!QuickActionsService.instance) {
      QuickActionsService.instance = new QuickActionsService();
    }
    return QuickActionsService.instance;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    // Set up static shortcuts
    await this.setupStaticActions();

    // Check for initial action (app launched via shortcut)
    const initialAction = await QuickActions.getInitialAction();
    if (initialAction) {
      this.pendingAction = this.parseAction(initialAction);
      trackEvent('quick_action_used', {
        action: this.pendingAction.type,
        source: 'launch',
      });
    }

    // Listen for actions while app is running
    this.subscription = QuickActions.addListener((action) => {
      const parsed = this.parseAction(action);
      trackEvent('quick_action_used', {
        action: parsed.type,
        source: 'foreground',
      });

      if (this.isReady && this.handler) {
        this.handler(parsed);
      } else {
        this.pendingAction = parsed;
      }
    });

    console.log('[QuickActions] Initialized');
  }

  private parseAction(action: QuickActions.Action): QuickActionData {
    return {
      type: action.id as QuickActionType,
      params: action.params as Record<string, string> | undefined,
    };
  }

  setReady(handler: QuickActionHandler): void {
    this.handler = handler;
    this.isReady = true;

    // Process pending action
    if (this.pendingAction) {
      handler(this.pendingAction);
      this.pendingAction = null;
    }
  }

  cleanup(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.handler = null;
    this.isReady = false;
  }

  // ==========================================================================
  // Static Actions
  // ==========================================================================

  private async setupStaticActions(): Promise<void> {
    try {
      await QuickActions.setItems(
        STATIC_ACTIONS.map((action) => ({
          id: action.id,
          title: action.title,
          subtitle: action.subtitle,
          icon: action.icon,
          params: action.params,
        }))
      );
    } catch (error) {
      console.error('[QuickActions] Failed to set static actions:', error);
    }
  }

  // ==========================================================================
  // Dynamic Actions
  // ==========================================================================

  async addRecentMatch(matchId: string, matchName: string): Promise<void> {
    try {
      const currentItems = await QuickActions.getItems();

      // Create dynamic action for recent match
      const recentMatchAction: QuickActions.Action = {
        id: 'open_chat',
        title: `Chat with ${matchName}`,
        subtitle: 'Recent match',
        icon: Platform.select({
          ios: 'symbol:bubble.left.fill',
          android: 'shortcut_chat',
        }) || 'chat',
        params: { matchId },
      };

      // Keep static actions and add recent match at the top
      const staticItems = currentItems.filter(
        (item) => !item.params?.matchId
      );

      // Limit to 4 total (iOS limit)
      const newItems = [recentMatchAction, ...staticItems].slice(0, 4);

      await QuickActions.setItems(newItems);
    } catch (error) {
      console.error('[QuickActions] Failed to add recent match:', error);
    }
  }

  async addRecentChat(matchId: string, matchName: string): Promise<void> {
    // Same as addRecentMatch but could be differentiated in the future
    await this.addRecentMatch(matchId, matchName);
  }

  async updateLikesCount(count: number): Promise<void> {
    if (count <= 0) return;

    try {
      const currentItems = await QuickActions.getItems();

      // Update or add likes action
      const likesAction: QuickActions.Action = {
        id: 'view_likes',
        title: 'View Likes',
        subtitle: `${count} people liked you`,
        icon: Platform.select({
          ios: 'symbol:star.fill',
          android: 'shortcut_star',
        }) || 'star',
      };

      // Find and replace existing likes action or add it
      const existingIndex = currentItems.findIndex((item) => item.id === 'view_likes');

      if (existingIndex >= 0) {
        currentItems[existingIndex] = likesAction;
      } else {
        // Insert after first static action
        currentItems.splice(1, 0, likesAction);
      }

      // Limit to 4 total
      await QuickActions.setItems(currentItems.slice(0, 4));
    } catch (error) {
      console.error('[QuickActions] Failed to update likes count:', error);
    }
  }

  async resetToDefaultActions(): Promise<void> {
    await this.setupStaticActions();
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getPendingAction(): QuickActionData | null {
    const action = this.pendingAction;
    this.pendingAction = null;
    return action;
  }

  hasPendingAction(): boolean {
    return this.pendingAction !== null;
  }
}

export const quickActionsService = QuickActionsService.getInstance();
export default quickActionsService;

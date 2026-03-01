import { useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  quickActionsService,
  QuickActionType,
  QuickActionData,
} from '../services/quickActions';
import { trackEvent } from '../services/analytics';

// ============================================================================
// useQuickActions - Main hook for handling quick actions
// ============================================================================

/**
 * React hook `useQuickActions`.
 * @returns Hook state and actions.
 * @example
 * const value = useQuickActions();
 */
export function useQuickActions() {
  const navigation = useNavigation<any>();

  const handleQuickAction = useCallback(
    (action: QuickActionData) => {
      trackEvent('quick_action_handled', {
        action: action.type,
        has_params: !!action.params,
      });

      switch (action.type) {
        case 'new_match':
          // Navigate to discovery/swiping screen
          navigation.navigate('Main', {
            screen: 'Discovery',
          });
          break;

        case 'view_matches':
          // Navigate to matches list
          navigation.navigate('Main', {
            screen: 'Matches',
            params: {
              screen: 'MatchList',
            },
          });
          break;

        case 'start_vr':
          // Navigate to VR screen
          navigation.navigate('VRLobby');
          break;

        case 'edit_profile':
          // Navigate to profile edit
          navigation.navigate('Main', {
            screen: 'Profile',
            params: {
              screen: 'EditProfile',
            },
          });
          break;

        case 'view_likes':
          // Navigate to likes screen
          navigation.navigate('Main', {
            screen: 'Likes',
          });
          break;

        case 'open_chat':
          // Navigate to specific chat
          if (action.params?.matchId) {
            navigation.navigate('Main', {
              screen: 'Matches',
              params: {
                screen: 'Chat',
                params: { matchId: action.params.matchId },
              },
            });
          }
          break;

        default:
          console.warn('[QuickActions] Unhandled action type:', action.type);
      }
    },
    [navigation]
  );

  useEffect(() => {
    // Register handler when component mounts
    quickActionsService.setReady(handleQuickAction);

    return () => {
      // Don't cleanup here as it may affect other screens
      // quickActionsService.cleanup();
    };
  }, [handleQuickAction]);

  return {
    handleQuickAction,
  };
}

// ============================================================================
// useQuickActionSetup - Initialize quick actions at app root
// ============================================================================

/**
 * React hook `useQuickActionSetup`.
 * @returns Hook state and actions.
 * @example
 * const value = useQuickActionSetup();
 */
export function useQuickActionSetup() {
  useEffect(() => {
    quickActionsService.initialize().catch((error) => {
      console.error('[QuickActions] Initialization failed:', error);
    });

    return () => {
      quickActionsService.cleanup();
    };
  }, []);
}

// ============================================================================
// useQuickActionUpdates - Update quick actions based on app state
// ============================================================================

/**
 * React hook `useQuickActionUpdates`.
 * @returns Hook state and actions.
 * @example
 * const value = useQuickActionUpdates();
 */
export function useQuickActionUpdates() {
  const updateRecentMatch = useCallback(
    async (matchId: string, matchName: string) => {
      await quickActionsService.addRecentMatch(matchId, matchName);
    },
    []
  );

  const updateRecentChat = useCallback(
    async (matchId: string, matchName: string) => {
      await quickActionsService.addRecentChat(matchId, matchName);
    },
    []
  );

  const updateLikesCount = useCallback(async (count: number) => {
    await quickActionsService.updateLikesCount(count);
  }, []);

  const resetActions = useCallback(async () => {
    await quickActionsService.resetToDefaultActions();
  }, []);

  return {
    updateRecentMatch,
    updateRecentChat,
    updateLikesCount,
    resetActions,
  };
}

export default useQuickActions;

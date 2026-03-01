import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { DEEP_LINK_CONFIG } from '../services/deepLinking';

// Type for root navigation params
export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  ResetPassword: { token: string };
  VerifyEmail: { token: string };
  Onboarding: undefined;

  // Main tabs
  Main: {
    screen?: string;
    params?: object;
  };

  // Standalone screens
  ViewProfile: { userId: string };
  VRInvite: { inviteCode: string };
  VRRoom: { roomId: string };
  Verification: { type: string };
  Share: { type: string; id: string };
};

// Create linking configuration for React Navigation
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: DEEP_LINK_CONFIG.prefixes,

  // Custom function to get initial URL
  async getInitialURL() {
    // Check if app was opened from a notification
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response?.notification.request.content.data?.url) {
      return response.notification.request.content.data.url as string;
    }

    // Check for deep link
    const url = await Linking.getInitialURL();
    return url;
  },

  // Custom function to subscribe to URL changes
  subscribe(listener) {
    // Listen for deep links
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });

    // Listen for notification taps
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (url && typeof url === 'string') {
          listener(url);
        }
      }
    );

    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
    };
  },

  // Screen configuration
  config: {
    screens: {
      // Auth screens
      Login: 'login',
      Register: 'register',
      ResetPassword: 'reset-password/:token',
      VerifyEmail: 'verify-email/:token',
      Onboarding: 'onboarding',

      // Main app with nested navigators
      Main: {
        screens: {
          Discovery: {
            path: 'discover',
          },
          Matches: {
            screens: {
              MatchList: 'matches',
              Chat: {
                path: 'chat/:matchId',
                parse: {
                  matchId: (matchId: string) => matchId,
                },
              },
            },
          },
          Profile: {
            screens: {
              MyProfile: 'profile',
              EditProfile: 'profile/edit',
              Settings: 'settings',
              SettingsDetail: {
                path: 'settings/:section',
                parse: {
                  section: (section: string) => section,
                },
              },
              AccessibilitySettings: 'settings/accessibility',
              NotificationSettings: 'settings/notifications',
              PrivacySettings: 'settings/privacy',
              LanguageSettings: 'settings/language',
            },
          },
        },
      },

      // Standalone screens
      ViewProfile: {
        path: 'profile/:userId',
        parse: {
          userId: (userId: string) => userId,
        },
      },
      VRInvite: {
        path: 'vr/invite/:inviteCode',
        parse: {
          inviteCode: (inviteCode: string) => inviteCode,
        },
      },
      VRRoom: {
        path: 'vr/room/:roomId',
        parse: {
          roomId: (roomId: string) => roomId,
        },
      },
      Verification: {
        path: 'verify/:type',
        parse: {
          type: (type: string) => type,
        },
      },
      Share: {
        path: 'share/:type/:id',
        parse: {
          type: (type: string) => type,
          id: (id: string) => id,
        },
      },
    },
  },
};

// Helper to create navigation state from deep link
export function getStateFromPath(path: string, options?: object) {
  // Custom path parsing if needed
  return undefined; // Let React Navigation handle it
}

// Notification data types
export interface NotificationData {
  type: 'match' | 'message' | 'like' | 'vr_invite' | 'system';
  url?: string;
  matchId?: string;
  userId?: string;
  inviteCode?: string;
}

// Helper to build notification URL
export function buildNotificationUrl(data: NotificationData): string {
  const baseUrl = 'dryft://';

  switch (data.type) {
    case 'match':
      return data.matchId ? `${baseUrl}chat/${data.matchId}` : `${baseUrl}matches`;
    case 'message':
      return data.matchId ? `${baseUrl}chat/${data.matchId}` : `${baseUrl}matches`;
    case 'like':
      return `${baseUrl}discover`;
    case 'vr_invite':
      return data.inviteCode ? `${baseUrl}vr/invite/${data.inviteCode}` : `${baseUrl}discover`;
    default:
      return baseUrl;
  }
}

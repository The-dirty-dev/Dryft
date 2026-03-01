import { Linking, Platform, Share } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { analytics, trackEvent } from './analytics';

/**
 * Deep link parsing, generation, and deferred link handling.
 * Provides helpers to navigate from URLs and generate shareable links.
 * @example
 * const link = generateDeepLink('profile', { userId: '123' });
 */
// Deep link configuration
export const DEEP_LINK_CONFIG = {
  prefixes: [
    'dryft://',
    'https://dryft.site',
    'https://www.dryft.site',
    'https://link.dryft.site',
  ],
  screens: {
    // Auth
    Login: 'login',
    Register: 'register',
    ResetPassword: 'reset-password/:token',
    VerifyEmail: 'verify-email/:token',

    // Main App
    Main: {
      screens: {
        // Discovery
        Discovery: 'discover',

        // Matches
        Matches: {
          screens: {
            MatchList: 'matches',
            Chat: 'chat/:matchId',
          },
        },

        // Profile
        Profile: {
          screens: {
            MyProfile: 'profile',
            EditProfile: 'profile/edit',
            Settings: 'settings',
            SettingsDetail: 'settings/:section',
          },
        },
      },
    },

    // Standalone screens
    ViewProfile: 'profile/:userId',
    VRInvite: 'vr/invite/:inviteCode',
    VRRoom: 'vr/room/:roomId',
    Share: 'share/:type/:id',
    Verification: 'verify/:type',
  },
};

// Link types
export type DeepLinkType =
  | 'profile'
  | 'match'
  | 'chat'
  | 'vr_invite'
  | 'vr_room'
  | 'settings'
  | 'verification'
  | 'share'
  | 'password_reset'
  | 'email_verify'
  | 'referral'
  | 'promo'
  | 'subscription'
  | 'onboarding';

// UTM/Campaign parameters
export interface CampaignParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
}

// Link data interfaces
export interface DeepLinkData {
  type: DeepLinkType;
  params: Record<string, string>;
  url: string;
  timestamp: number;
}

export interface ProfileLinkParams {
  userId: string;
  source?: 'share' | 'match' | 'notification';
}

export interface ChatLinkParams {
  matchId: string;
  messageId?: string;
}

export interface VRInviteLinkParams {
  inviteCode: string;
  hostName?: string;
  roomType?: string;
}

export interface ReferralLinkParams {
  referralCode: string;
  referrerName?: string;
  campaign?: string;
}

export interface PromoLinkParams {
  promoCode: string;
  discount?: string;
  expiresAt?: string;
}

// Storage keys for deferred deep linking
const DEFERRED_LINK_KEY = 'dryft_deferred_deep_link';
const CAMPAIGN_PARAMS_KEY = 'dryft_campaign_params';
const REFERRAL_CODE_KEY = 'dryft_referral_code';

// Parse a deep link URL into structured data
export function parseDeepLink(url: string): DeepLinkData | null {
  if (!url) return null;

  try {
    const parsed = ExpoLinking.parse(url);
    const path = parsed.path || '';
    const params = parsed.queryParams || {};

    // Profile link: dryft://profile/123 or https://dryft.site/profile/123
    if (path.startsWith('profile/')) {
      const userId = path.replace('profile/', '').split('/')[0];
      return {
        type: 'profile',
        params: { userId, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Chat link: dryft://chat/match123
    if (path.startsWith('chat/')) {
      const matchId = path.replace('chat/', '').split('/')[0];
      return {
        type: 'chat',
        params: { matchId, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // VR invite: dryft://vr/invite/ABC123
    if (path.startsWith('vr/invite/')) {
      const inviteCode = path.replace('vr/invite/', '').split('/')[0];
      return {
        type: 'vr_invite',
        params: { inviteCode, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // VR room: dryft://vr/room/room123
    if (path.startsWith('vr/room/')) {
      const roomId = path.replace('vr/room/', '').split('/')[0];
      return {
        type: 'vr_room',
        params: { roomId, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Settings: dryft://settings/accessibility
    if (path.startsWith('settings/')) {
      const section = path.replace('settings/', '').split('/')[0];
      return {
        type: 'settings',
        params: { section, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Password reset: dryft://reset-password/token123
    if (path.startsWith('reset-password/')) {
      const token = path.replace('reset-password/', '').split('/')[0];
      return {
        type: 'password_reset',
        params: { token, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Email verification: dryft://verify-email/token123
    if (path.startsWith('verify-email/')) {
      const token = path.replace('verify-email/', '').split('/')[0];
      return {
        type: 'email_verify',
        params: { token, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Verification: dryft://verify/photo
    if (path.startsWith('verify/')) {
      const type = path.replace('verify/', '').split('/')[0];
      return {
        type: 'verification',
        params: { verificationType: type, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Share link: dryft://share/profile/123
    if (path.startsWith('share/')) {
      const parts = path.replace('share/', '').split('/');
      return {
        type: 'share',
        params: { shareType: parts[0], shareId: parts[1], ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Match link: dryft://matches or dryft://match/123
    if (path === 'matches' || path.startsWith('match/')) {
      const matchId = path.startsWith('match/') ? path.replace('match/', '') : undefined;
      return {
        type: 'match',
        params: { matchId, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Referral link: dryft://r/ABC123 or dryft://referral/ABC123
    if (path.startsWith('r/') || path.startsWith('referral/')) {
      const referralCode = path.replace(/^(r|referral)\//, '').split('/')[0];
      return {
        type: 'referral',
        params: { referralCode, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Promo link: dryft://promo/SAVE20
    if (path.startsWith('promo/')) {
      const promoCode = path.replace('promo/', '').split('/')[0];
      return {
        type: 'promo',
        params: { promoCode, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Subscription link: dryft://subscribe
    if (path === 'subscribe' || path.startsWith('subscribe/')) {
      const plan = path.replace('subscribe/', '').split('/')[0] || undefined;
      return {
        type: 'subscription',
        params: { plan, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Onboarding link: dryft://onboarding/step
    if (path.startsWith('onboarding/')) {
      const step = path.replace('onboarding/', '').split('/')[0];
      return {
        type: 'onboarding',
        params: { step, ...params },
        url,
        timestamp: Date.now(),
      };
    }

    // Unknown link type
    return {
      type: 'share',
      params: { path, ...params },
      url,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to parse deep link:', error);
    return null;
  }
}

// Generate deep links
export function generateDeepLink(
  type: DeepLinkType,
  params: Record<string, string>,
  campaignParams?: CampaignParams
): string {
  const baseUrl = 'https://dryft.site';
  let url: string;

  switch (type) {
    case 'profile':
      url = `${baseUrl}/profile/${params.userId}`;
      break;
    case 'chat':
      url = `${baseUrl}/chat/${params.matchId}`;
      break;
    case 'vr_invite':
      url = `${baseUrl}/vr/invite/${params.inviteCode}`;
      break;
    case 'vr_room':
      url = `${baseUrl}/vr/room/${params.roomId}`;
      break;
    case 'settings':
      url = `${baseUrl}/settings/${params.section || ''}`;
      break;
    case 'verification':
      url = `${baseUrl}/verify/${params.type}`;
      break;
    case 'share':
      url = `${baseUrl}/share/${params.shareType}/${params.shareId}`;
      break;
    case 'referral':
      url = `${baseUrl}/r/${params.referralCode}`;
      break;
    case 'promo':
      url = `${baseUrl}/promo/${params.promoCode}`;
      break;
    case 'subscription':
      url = params.plan ? `${baseUrl}/subscribe/${params.plan}` : `${baseUrl}/subscribe`;
      break;
    case 'onboarding':
      url = `${baseUrl}/onboarding/${params.step || ''}`;
      break;
    default:
      url = baseUrl;
  }

  // Append campaign params if provided
  if (campaignParams) {
    const queryParams = Object.entries(campaignParams)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
      .join('&');
    if (queryParams) {
      url += (url.includes('?') ? '&' : '?') + queryParams;
    }
  }

  return url;
}

// Generate app-specific links (for internal use)
export function generateAppLink(type: DeepLinkType, params: Record<string, string>): string {
  const scheme = 'dryft://';

  switch (type) {
    case 'profile':
      return `${scheme}profile/${params.userId}`;
    case 'chat':
      return `${scheme}chat/${params.matchId}`;
    case 'vr_invite':
      return `${scheme}vr/invite/${params.inviteCode}`;
    case 'vr_room':
      return `${scheme}vr/room/${params.roomId}`;
    default:
      return scheme;
  }
}

// Deep link service class
class DeepLinkService {
  private pendingLink: DeepLinkData | null = null;
  private isReady = false;
  private listeners: Set<(link: DeepLinkData) => void> = new Set();
  private campaignParams: CampaignParams | null = null;

  async initialize(): Promise<void> {
    // Load any stored deferred link
    await this.loadDeferredLink();

    // Get initial URL if app was opened via deep link
    const initialUrl = await ExpoLinking.getInitialURL();
    if (initialUrl) {
      const linkData = parseDeepLink(initialUrl);
      if (linkData) {
        this.pendingLink = linkData;
        await this.extractCampaignParams(linkData);
        trackEvent('deep_link_received', {
          type: linkData.type,
          source: 'initial',
          url: initialUrl.split('?')[0],
        });
      }
    }

    // Listen for incoming links while app is open
    Linking.addEventListener('url', this.handleUrl);
  }

  private handleUrl = async ({ url }: { url: string }) => {
    const linkData = parseDeepLink(url);
    if (linkData) {
      await this.extractCampaignParams(linkData);
      trackEvent('deep_link_received', {
        type: linkData.type,
        source: 'foreground',
        url: url.split('?')[0],
      });

      if (this.isReady) {
        this.notifyListeners(linkData);
      } else {
        this.pendingLink = linkData;
      }
    }
  };

  setReady(): void {
    this.isReady = true;

    // Process pending link if exists
    if (this.pendingLink) {
      this.notifyListeners(this.pendingLink);
      this.pendingLink = null;
    }
  }

  getPendingLink(): DeepLinkData | null {
    const link = this.pendingLink;
    this.pendingLink = null;
    return link;
  }

  addListener(callback: (link: DeepLinkData) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(link: DeepLinkData): void {
    this.listeners.forEach((callback) => {
      try {
        callback(link);
      } catch (error) {
        console.error('Deep link listener error:', error);
      }
    });
  }

  cleanup(): void {
    Linking.removeAllListeners('url');
    this.listeners.clear();
  }

  // ==========================================================================
  // Campaign/UTM Tracking
  // ==========================================================================

  private async extractCampaignParams(linkData: DeepLinkData): Promise<void> {
    const params = linkData.params;
    const campaign: CampaignParams = {};

    if (params.utm_source) campaign.utm_source = params.utm_source;
    if (params.utm_medium) campaign.utm_medium = params.utm_medium;
    if (params.utm_campaign) campaign.utm_campaign = params.utm_campaign;
    if (params.utm_content) campaign.utm_content = params.utm_content;
    if (params.utm_term) campaign.utm_term = params.utm_term;
    if (params.referrer) campaign.referrer = params.referrer;

    if (Object.keys(campaign).length > 0) {
      this.campaignParams = campaign;
      await AsyncStorage.setItem(CAMPAIGN_PARAMS_KEY, JSON.stringify(campaign));

      trackEvent('campaign_attributed', {
        ...campaign,
        link_type: linkData.type,
      });
    }

    // Store referral code if present
    if (linkData.type === 'referral' && params.referralCode) {
      await AsyncStorage.setItem(REFERRAL_CODE_KEY, params.referralCode);
    }
  }

  async getCampaignParams(): Promise<CampaignParams | null> {
    if (this.campaignParams) {
      return this.campaignParams;
    }

    try {
      const stored = await AsyncStorage.getItem(CAMPAIGN_PARAMS_KEY);
      if (stored) {
        this.campaignParams = JSON.parse(stored);
        return this.campaignParams;
      }
    } catch (error) {
      console.error('Failed to load campaign params:', error);
    }

    return null;
  }

  async getReferralCode(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(REFERRAL_CODE_KEY);
    } catch {
      return null;
    }
  }

  async clearReferralCode(): Promise<void> {
    await AsyncStorage.removeItem(REFERRAL_CODE_KEY);
  }

  // ==========================================================================
  // Deferred Deep Linking
  // ==========================================================================

  async saveDeferredLink(link: DeepLinkData): Promise<void> {
    try {
      await AsyncStorage.setItem(DEFERRED_LINK_KEY, JSON.stringify(link));
    } catch (error) {
      console.error('Failed to save deferred link:', error);
    }
  }

  private async loadDeferredLink(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(DEFERRED_LINK_KEY);
      if (stored) {
        const link = JSON.parse(stored) as DeepLinkData;
        // Only use if less than 7 days old
        if (Date.now() - link.timestamp < 7 * 24 * 60 * 60 * 1000) {
          this.pendingLink = link;
          trackEvent('deferred_deep_link_restored', {
            type: link.type,
            age_hours: Math.floor((Date.now() - link.timestamp) / (60 * 60 * 1000)),
          });
        }
        await AsyncStorage.removeItem(DEFERRED_LINK_KEY);
      }
    } catch (error) {
      console.error('Failed to load deferred link:', error);
    }
  }

  // ==========================================================================
  // External Link Helpers
  // ==========================================================================

  async openURL(url: string): Promise<boolean> {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to open URL:', error);
      return false;
    }
  }

  async openInAppBrowser(url: string): Promise<void> {
    try {
      await WebBrowser.openBrowserAsync(url, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: '#8B5CF6',
      });
    } catch (error) {
      console.error('Failed to open in-app browser:', error);
      // Fallback to external browser
      await this.openURL(url);
    }
  }

  async openAppSettings(): Promise<void> {
    await Linking.openSettings();
  }

  async openMailApp(email?: string, subject?: string, body?: string): Promise<void> {
    let url = 'mailto:';
    if (email) url += email;

    const params: string[] = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    await this.openURL(url);
  }

  async openSMS(phoneNumber?: string, body?: string): Promise<void> {
    let url = 'sms:';
    if (phoneNumber) url += phoneNumber;
    if (body) {
      const separator = Platform.OS === 'ios' ? '&' : '?';
      url += `${separator}body=${encodeURIComponent(body)}`;
    }
    await this.openURL(url);
  }

  async openMaps(address: string): Promise<void> {
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });

    if (url) {
      await this.openURL(url);
    }
  }

  getAppStoreUrl(): string {
    return Platform.select({
      ios: 'https://apps.apple.com/app/dryft/id123456789',
      android: 'https://play.google.com/store/apps/details?id=com.dryft.site',
    }) || '';
  }

  async openAppStore(): Promise<void> {
    await this.openURL(this.getAppStoreUrl());
  }
}

export const deepLinkService = new DeepLinkService();

// Hook for handling deep links in navigation
export function useDeepLinkHandler() {
  const navigation = useNavigation<any>();

  const handleDeepLink = useCallback(
    (link: DeepLinkData) => {
      switch (link.type) {
        case 'profile':
          navigation.navigate('ViewProfile', { userId: link.params.userId });
          break;

        case 'chat':
          navigation.navigate('Main', {
            screen: 'Matches',
            params: {
              screen: 'Chat',
              params: { matchId: link.params.matchId },
            },
          });
          break;

        case 'match':
          if (link.params.matchId) {
            navigation.navigate('Main', {
              screen: 'Matches',
              params: {
                screen: 'Chat',
                params: { matchId: link.params.matchId },
              },
            });
          } else {
            navigation.navigate('Main', { screen: 'Matches' });
          }
          break;

        case 'vr_invite':
          navigation.navigate('VRInvite', { inviteCode: link.params.inviteCode });
          break;

        case 'vr_room':
          navigation.navigate('VRRoom', { roomId: link.params.roomId });
          break;

        case 'settings':
          if (link.params.section) {
            navigation.navigate('Main', {
              screen: 'Profile',
              params: {
                screen: 'SettingsDetail',
                params: { section: link.params.section },
              },
            });
          } else {
            navigation.navigate('Main', {
              screen: 'Profile',
              params: { screen: 'Settings' },
            });
          }
          break;

        case 'password_reset':
          navigation.navigate('ResetPassword', { token: link.params.token });
          break;

        case 'email_verify':
          navigation.navigate('VerifyEmail', { token: link.params.token });
          break;

        case 'verification':
          navigation.navigate('Verification', { type: link.params.verificationType });
          break;

        case 'referral':
          // Store referral code and navigate to signup/home
          navigation.navigate('Main', {
            screen: 'Discovery',
            params: { referralCode: link.params.referralCode },
          });
          break;

        case 'promo':
          navigation.navigate('Main', {
            screen: 'Profile',
            params: {
              screen: 'Subscription',
              params: { promoCode: link.params.promoCode },
            },
          });
          break;

        case 'subscription':
          navigation.navigate('Main', {
            screen: 'Profile',
            params: {
              screen: 'Subscription',
              params: { plan: link.params.plan },
            },
          });
          break;

        case 'onboarding':
          navigation.navigate('Onboarding', { step: link.params.step });
          break;

        default:
          console.log('Unhandled deep link type:', link.type);
      }
    },
    [navigation]
  );

  useEffect(() => {
    const unsubscribe = deepLinkService.addListener(handleDeepLink);

    // Check for pending link
    const pendingLink = deepLinkService.getPendingLink();
    if (pendingLink) {
      handleDeepLink(pendingLink);
    }

    return unsubscribe;
  }, [handleDeepLink]);

  return { handleDeepLink };
}

// Hook for generating shareable links
export function useShareableLink() {
  const [isSharing, setIsSharing] = useState(false);

  const generateProfileLink = useCallback((userId: string, source?: string) => {
    return generateDeepLink('profile', { userId }, source ? { utm_source: source } : undefined);
  }, []);

  const generateVRInviteLink = useCallback((inviteCode: string) => {
    return generateDeepLink('vr_invite', { inviteCode });
  }, []);

  const generateReferralLink = useCallback((referralCode: string, campaign?: string) => {
    return generateDeepLink('referral', { referralCode }, campaign ? { utm_campaign: campaign } : undefined);
  }, []);

  const generatePromoLink = useCallback((promoCode: string, source?: string) => {
    return generateDeepLink('promo', { promoCode }, source ? { utm_source: source } : undefined);
  }, []);

  const shareProfile = useCallback(async (userId: string, userName: string) => {
    if (isSharing) return;
    setIsSharing(true);

    const url = generateProfileLink(userId, 'share');
    const message = `Check out ${userName}'s profile on Dryft!`;

    try {
      const result = await Share.share(
        Platform.select({
          ios: {
            message: message,
            url: url,
          },
          default: {
            message: `${message}\n${url}`,
          },
        }) as any,
        {
          dialogTitle: 'Share Profile',
        }
      );

      if (result.action === Share.sharedAction) {
        trackEvent('content_shared', {
          type: 'profile',
          user_id: userId,
          shared_to: result.activityType || 'unknown',
        });
      }
    } catch (error) {
      console.error('Failed to share profile:', error);
    } finally {
      setIsSharing(false);
    }
  }, [generateProfileLink, isSharing]);

  const shareVRInvite = useCallback(async (inviteCode: string, hostName: string) => {
    if (isSharing) return;
    setIsSharing(true);

    const url = generateVRInviteLink(inviteCode);
    const message = `${hostName} invited you to a VR date on Dryft!`;

    try {
      const result = await Share.share(
        Platform.select({
          ios: {
            message: message,
            url: url,
          },
          default: {
            message: `${message}\n${url}`,
          },
        }) as any,
        {
          dialogTitle: 'VR Date Invite',
        }
      );

      if (result.action === Share.sharedAction) {
        trackEvent('content_shared', {
          type: 'vr_invite',
          invite_code: inviteCode,
          shared_to: result.activityType || 'unknown',
        });
      }
    } catch (error) {
      console.error('Failed to share VR invite:', error);
    } finally {
      setIsSharing(false);
    }
  }, [generateVRInviteLink, isSharing]);

  const shareReferral = useCallback(async (referralCode: string, userName: string) => {
    if (isSharing) return;
    setIsSharing(true);

    const url = generateReferralLink(referralCode, 'referral');
    const message = `Join me on Dryft! Use my referral link to get started: ${url}`;

    try {
      const result = await Share.share(
        {
          message,
          title: `${userName} invites you to Dryft`,
        },
        {
          dialogTitle: 'Share Referral',
        }
      );

      if (result.action === Share.sharedAction) {
        trackEvent('content_shared', {
          type: 'referral',
          referral_code: referralCode,
          shared_to: result.activityType || 'unknown',
        });
      }
    } catch (error) {
      console.error('Failed to share referral:', error);
    } finally {
      setIsSharing(false);
    }
  }, [generateReferralLink, isSharing]);

  const shareApp = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    const appStoreUrl = deepLinkService.getAppStoreUrl();
    const message = `I've been using Dryft for VR dating and it's amazing! Check it out: ${appStoreUrl}`;

    try {
      const result = await Share.share(
        {
          message,
          title: 'Try Dryft',
        },
        {
          dialogTitle: 'Share Dryft',
        }
      );

      if (result.action === Share.sharedAction) {
        trackEvent('content_shared', {
          type: 'app',
          shared_to: result.activityType || 'unknown',
        });
      }
    } catch (error) {
      console.error('Failed to share app:', error);
    } finally {
      setIsSharing(false);
    }
  }, [isSharing]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      const Clipboard = require('@react-native-clipboard/clipboard').default;
      Clipboard.setString(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);

  return {
    isSharing,
    generateProfileLink,
    generateVRInviteLink,
    generateReferralLink,
    generatePromoLink,
    shareProfile,
    shareVRInvite,
    shareReferral,
    shareApp,
    copyToClipboard,
  };
}

// Hook for accessing campaign attribution
export function useCampaignAttribution() {
  const [campaignParams, setCampaignParams] = useState<CampaignParams | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const loadAttribution = async () => {
      const params = await deepLinkService.getCampaignParams();
      const code = await deepLinkService.getReferralCode();
      setCampaignParams(params);
      setReferralCode(code);
    };

    loadAttribution();
  }, []);

  return {
    campaignParams,
    referralCode,
  };
}

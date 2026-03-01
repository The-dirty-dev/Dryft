import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShareableLink } from '../services/deepLinking';
import { trackEvent } from '../services/analytics';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

export type ShareType = 'profile' | 'vr_invite' | 'referral' | 'app' | 'custom';

export interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  type: ShareType;
  data: {
    userId?: string;
    userName?: string;
    inviteCode?: string;
    referralCode?: string;
    customTitle?: string;
    customMessage?: string;
    customUrl?: string;
  };
}

interface ShareOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  action: () => Promise<void>;
}

// ============================================================================
// Share Sheet Component
// ============================================================================

export function ShareSheet({ visible, onClose, type, data }: ShareSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    shareProfile,
    shareVRInvite,
    shareReferral,
    shareApp,
    generateProfileLink,
    generateVRInviteLink,
    generateReferralLink,
    copyToClipboard,
  } = useShareableLink();

  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  const getShareLink = useCallback((): string => {
    switch (type) {
      case 'profile':
        return data.userId ? generateProfileLink(data.userId, 'share') : '';
      case 'vr_invite':
        return data.inviteCode ? generateVRInviteLink(data.inviteCode) : '';
      case 'referral':
        return data.referralCode ? generateReferralLink(data.referralCode) : '';
      case 'custom':
        return data.customUrl || '';
      default:
        return 'https://dryft.site';
    }
  }, [type, data, generateProfileLink, generateVRInviteLink, generateReferralLink]);

  const handleShare = useCallback(async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      switch (type) {
        case 'profile':
          if (data.userId && data.userName) {
            await shareProfile(data.userId, data.userName);
          }
          break;
        case 'vr_invite':
          if (data.inviteCode && data.userName) {
            await shareVRInvite(data.inviteCode, data.userName);
          }
          break;
        case 'referral':
          if (data.referralCode && data.userName) {
            await shareReferral(data.referralCode, data.userName);
          }
          break;
        case 'app':
          await shareApp();
          break;
      }
      onClose();
    } catch (error) {
      console.error('Share failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [type, data, shareProfile, shareVRInvite, shareReferral, shareApp, onClose]);

  const handleCopyLink = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const link = getShareLink();
    const success = await copyToClipboard(link);

    if (success) {
      setCopied(true);
      trackEvent('link_copied', { type });
      setTimeout(() => setCopied(false), 2000);
    }
  }, [getShareLink, copyToClipboard, type]);

  const getTitle = (): string => {
    switch (type) {
      case 'profile':
        return `Share ${data.userName || 'Profile'}`;
      case 'vr_invite':
        return 'Share VR Invite';
      case 'referral':
        return 'Share Referral';
      case 'app':
        return 'Share Dryft';
      case 'custom':
        return data.customTitle || 'Share';
      default:
        return 'Share';
    }
  };

  const getSubtitle = (): string => {
    switch (type) {
      case 'profile':
        return 'Share this profile with friends';
      case 'vr_invite':
        return 'Invite someone to your VR date';
      case 'referral':
        return 'Earn rewards when friends join';
      case 'app':
        return 'Help your friends find love';
      case 'custom':
        return data.customMessage || '';
      default:
        return '';
    }
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }] },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{getTitle()}</Text>
              <Text style={styles.subtitle}>{getSubtitle()}</Text>
            </View>

            {/* Link Preview */}
            <View style={styles.linkPreview}>
              <View style={styles.linkIconContainer}>
                <Ionicons name="link" size={20} color={colors.accent} />
              </View>
              <Text style={styles.linkText} numberOfLines={1}>
                {getShareLink()}
              </Text>
              <TouchableOpacity
                style={[styles.copyButton, copied && styles.copyButtonSuccess]}
                onPress={handleCopyLink}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={18}
                  color={copied ? colors.success : colors.accent}
                />
              </TouchableOpacity>
            </View>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={22} color={colors.text} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <QuickShareButton
                icon="chatbubble-ellipses"
                label="Messages"
                color={colors.success}
                onPress={handleShare}
              />
              <QuickShareButton
                icon="mail"
                label="Email"
                color={colors.info}
                onPress={handleShare}
              />
              <QuickShareButton
                icon="logo-whatsapp"
                label="WhatsApp"
                color={colors.like}
                onPress={handleShare}
              />
              <QuickShareButton
                icon="ellipsis-horizontal"
                label="More"
                color={colors.textSecondary}
                onPress={handleShare}
              />
            </View>

            {/* Cancel */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// Quick Share Button
// ============================================================================

interface QuickShareButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

function QuickShareButton({ icon, label, color, onPress }: QuickShareButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.quickButton} onPress={onPress}>
      <View style={[styles.quickButtonIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color={colors.text} />
      </View>
      <Text style={styles.quickButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// Share Profile Card (for embedding in profile screens)
// ============================================================================

interface ShareProfileCardProps {
  userId: string;
  userName: string;
  onShare?: () => void;
}

export function ShareProfileCard({ userId, userName, onShare }: ShareProfileCardProps) {
  const [showSheet, setShowSheet] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSheet(true);
    onShare?.();
  };

  return (
    <>
      <TouchableOpacity style={styles.shareCard} onPress={handlePress}>
        <View style={styles.shareCardIcon}>
          <Ionicons name="share-social" size={24} color={colors.accent} />
        </View>
        <View style={styles.shareCardContent}>
          <Text style={styles.shareCardTitle}>Share Profile</Text>
          <Text style={styles.shareCardSubtitle}>
            Let friends know about this profile
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <ShareSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        type="profile"
        data={{ userId, userName }}
      />
    </>
  );
}

// ============================================================================
// Referral Card
// ============================================================================

interface ReferralCardProps {
  referralCode: string;
  userName: string;
  rewardsEarned?: number;
  friendsInvited?: number;
}

export function ReferralCard({
  referralCode,
  userName,
  rewardsEarned = 0,
  friendsInvited = 0,
}: ReferralCardProps) {
  const [showSheet, setShowSheet] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <View style={styles.referralCard}>
        <View style={styles.referralHeader}>
          <View style={styles.referralIconContainer}>
            <Ionicons name="gift" size={28} color={colors.text} />
          </View>
          <View style={styles.referralHeaderText}>
            <Text style={styles.referralTitle}>Invite Friends</Text>
            <Text style={styles.referralSubtitle}>
              Earn rewards for each friend who joins
            </Text>
          </View>
        </View>

        <View style={styles.referralStats}>
          <View style={styles.referralStat}>
            <Text style={styles.referralStatValue}>{friendsInvited}</Text>
            <Text style={styles.referralStatLabel}>Friends Invited</Text>
          </View>
          <View style={styles.referralStatDivider} />
          <View style={styles.referralStat}>
            <Text style={styles.referralStatValue}>${rewardsEarned}</Text>
            <Text style={styles.referralStatLabel}>Rewards Earned</Text>
          </View>
        </View>

        <View style={styles.referralCodeContainer}>
          <Text style={styles.referralCodeLabel}>Your referral code</Text>
          <Text style={styles.referralCode}>{referralCode}</Text>
        </View>

        <TouchableOpacity
          style={styles.referralShareButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowSheet(true);
          }}
        >
          <Ionicons name="share-outline" size={20} color={colors.text} />
          <Text style={styles.referralShareText}>Share Invite Link</Text>
        </TouchableOpacity>
      </View>

      <ShareSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        type="referral"
        data={{ referralCode, userName }}
      />
    </>
  );
}

// ============================================================================
// Hook for programmatic share
// ============================================================================

export function useShareSheet() {
  const [shareConfig, setShareConfig] = useState<{
    visible: boolean;
    type: ShareType;
    data: ShareSheetProps['data'];
  }>({
    visible: false,
    type: 'app',
    data: {},
  });

  const showShareSheet = useCallback((type: ShareType, data: ShareSheetProps['data']) => {
    setShareConfig({ visible: true, type, data });
  }, []);

  const hideShareSheet = useCallback(() => {
    setShareConfig(prev => ({ ...prev, visible: false }));
  }, []);

  const ShareSheetComponent = useCallback(() => (
    <ShareSheet
      visible={shareConfig.visible}
      onClose={hideShareSheet}
      type={shareConfig.type}
      data={shareConfig.data}
    />
  ), [shareConfig, hideShareSheet]);

  return {
    showShareSheet,
    hideShareSheet,
    ShareSheetComponent,
  };
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.backgroundDarkest,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  linkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: withAlpha(colors.accent, '33'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: withAlpha(colors.accent, '33'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonSuccess: {
    backgroundColor: withAlpha(colors.success, '33'),
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  quickButton: {
    alignItems: 'center',
  },
  quickButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickButtonLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 20,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  // Share Card
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  shareCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.accent, '33'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shareCardContent: {
    flex: 1,
  },
  shareCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  shareCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Referral Card
  referralCard: {
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 16,
    padding: 20,
    margin: 16,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  referralIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  referralHeaderText: {
    flex: 1,
  },
  referralTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  referralSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  referralStats: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  referralStat: {
    flex: 1,
    alignItems: 'center',
  },
  referralStatDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 4,
  },
  referralStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
  },
  referralStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  referralCodeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  referralCodeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  referralCode: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  referralShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  referralShareText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});

export default ShareSheet;

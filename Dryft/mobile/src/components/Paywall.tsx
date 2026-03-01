import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscriptionStore, Entitlements, SubscriptionTier } from '../store/subscriptionStore';

const { width } = Dimensions.get('window');
const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

interface PaywallProps {
  feature: keyof Entitlements;
  featureLabel: string;
  description?: string;
  minimumTier?: SubscriptionTier;
  onClose?: () => void;
  children?: React.ReactNode;
}

/**
 * Paywall component that blocks access to premium features.
 * Wraps content and shows upgrade prompt if user doesn't have access.
 */
export function Paywall({
  feature,
  featureLabel,
  description,
  minimumTier = 'plus',
  onClose,
  children,
}: PaywallProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { hasEntitlement } = useSubscriptionStore();

  const hasAccess = hasEntitlement(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  const handleUpgrade = () => {
    navigation.navigate('Subscription', { feature: featureLabel });
    onClose?.();
  };

  return (
    <View style={styles.container}>
      {/* Show blurred/locked content */}
      <View style={styles.lockedContent}>
        {children}
        <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
      </View>

      {/* Overlay */}
      <View style={[styles.overlay, { backgroundColor: theme.colors.background + 'E6' }]}>
        <View style={[styles.lockIcon, { backgroundColor: withAlpha(theme.colors.primary, '1A') }]}>
          <Ionicons name="lock-closed" size={48} color={theme.colors.primary} />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          {featureLabel}
        </Text>

        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
          {description || `Upgrade to ${minimumTier} to unlock ${featureLabel.toLowerCase()}`}
        </Text>

        <TouchableOpacity onPress={handleUpgrade}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark]}
            style={styles.upgradeButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="diamond" size={20} color={theme.colors.text} />
            <Text style={[styles.upgradeButtonText, { color: theme.colors.text }]}>Upgrade Now</Text>
          </LinearGradient>
        </TouchableOpacity>

        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: theme.colors.textSecondary }]}>
              Maybe Later
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

interface PaywallModalProps {
  visible: boolean;
  feature: keyof Entitlements;
  featureLabel: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  benefits?: string[];
  onClose: () => void;
}

/**
 * Modal paywall for inline upgrade prompts.
 */
export function PaywallModal({
  visible,
  feature,
  featureLabel,
  description,
  icon = 'lock-closed',
  benefits = [],
  onClose,
}: PaywallModalProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const handleUpgrade = () => {
    onClose();
    navigation.navigate('Subscription', { feature: featureLabel });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <LinearGradient
            colors={[theme.colors.primary + '40', 'transparent']}
            style={styles.modalIconBg}
          >
            <Ionicons name={icon} size={40} color={theme.colors.primary} />
          </LinearGradient>

          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Unlock {featureLabel}
          </Text>

          <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
            {description || `Get access to ${featureLabel.toLowerCase()} with a premium subscription.`}
          </Text>

          {benefits.length > 0 && (
            <View style={styles.benefitsList}>
              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={theme.colors.success}
                  />
                  <Text style={[styles.benefitText, { color: theme.colors.text }]}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={handleUpgrade} style={styles.modalUpgradeButton}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryDark]}
              style={styles.modalUpgradeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.modalUpgradeText, { color: theme.colors.text }]}>View Plans</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.modalSkipText, { color: theme.colors.textMuted }]}>
              Not Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Hook to check if a feature requires premium access.
 */
export function usePremiumFeature(feature: keyof Entitlements) {
  const { hasEntitlement, subscription } = useSubscriptionStore();
  const navigation = useNavigation<any>();

  const hasAccess = hasEntitlement(feature);
  const tier = subscription?.tier || 'free';

  const requirePremium = (featureLabel: string) => {
    if (hasAccess) return true;

    navigation.navigate('Subscription', { feature: featureLabel });
    return false;
  };

  return {
    hasAccess,
    tier,
    requirePremium,
  };
}

/**
 * Premium badge to indicate a feature requires upgrade.
 */
interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function PremiumBadge({ size = 'medium', showLabel = true }: PremiumBadgeProps) {
  const theme = useTheme();

  const sizes = {
    small: { icon: 12, padding: 4, fontSize: 10 },
    medium: { icon: 14, padding: 6, fontSize: 12 },
    large: { icon: 18, padding: 8, fontSize: 14 },
  };

  const s = sizes[size];

  return (
    <LinearGradient
      colors={[theme.colors.warning, theme.colors.primaryDark]}
      style={[styles.premiumBadge, { padding: s.padding }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Ionicons name="diamond" size={s.icon} color={theme.colors.text} />
      {showLabel && (
        <Text style={[styles.premiumBadgeText, { fontSize: s.fontSize, color: theme.colors.text }]}>
          PREMIUM
        </Text>
      )}
    </LinearGradient>
  );
}

/**
 * Inline upgrade prompt for showing in lists or cards.
 */
interface UpgradePromptProps {
  title: string;
  subtitle?: string;
  compact?: boolean;
}

export function UpgradePrompt({ title, subtitle, compact = false }: UpgradePromptProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Subscription')}
      style={[
        styles.upgradePrompt,
        { backgroundColor: theme.colors.primary + '15' },
        compact && styles.upgradePromptCompact,
      ]}
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark]}
        style={styles.upgradePromptIcon}
      >
        <Ionicons name="diamond" size={compact ? 16 : 20} color={theme.colors.text} />
      </LinearGradient>

      <View style={styles.upgradePromptText}>
        <Text
          style={[
            styles.upgradePromptTitle,
            { color: theme.colors.text },
            compact && styles.upgradePromptTitleCompact,
          ]}
        >
          {title}
        </Text>
        {subtitle && !compact && (
          <Text style={[styles.upgradePromptSubtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  lockedContent: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 16,
    padding: 8,
  },
  closeText: {
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: width - 48,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  modalIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  benefitsList: {
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
  },
  modalUpgradeButton: {
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  modalUpgradeGradient: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalUpgradeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSkipText: {
    fontSize: 14,
    padding: 8,
  },
  // Premium badge
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 4,
  },
  premiumBadgeText: {
    fontWeight: '700',
  },
  // Upgrade prompt
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  upgradePromptCompact: {
    padding: 12,
  },
  upgradePromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradePromptText: {
    flex: 1,
  },
  upgradePromptTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  upgradePromptTitleCompact: {
    fontSize: 14,
  },
  upgradePromptSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});

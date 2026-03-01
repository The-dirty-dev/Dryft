import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useOfflineIndicator } from '../hooks/useOffline';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

interface OfflineBannerProps {
  showPendingCount?: boolean;
  onPress?: () => void;
}

/**
 * Banner that appears at the top of the screen when offline.
 */
export function OfflineBanner({ showPendingCount = true, onPress }: OfflineBannerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isOffline, offlineDuration, pendingActions, hasPendingActions } = useOfflineIndicator();

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOffline ? 0 : -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isOffline ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOffline, slideAnim, opacityAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.warning,
          paddingTop: insets.top + 8,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        style={styles.bannerContent}
        disabled={!onPress}
        accessibilityRole="alert"
        accessibilityLabel={`You are offline. ${hasPendingActions ? `${pendingActions} actions pending.` : ''}`}
      >
        <Ionicons name="cloud-offline" size={18} color={theme.colors.textInverse} />
        <View style={styles.bannerTextContainer}>
          <Text style={[styles.bannerTitle, { color: theme.colors.textInverse }]}>You're Offline</Text>
          {offlineDuration && (
            <Text style={[styles.bannerSubtitle, { color: withAlpha(theme.colors.textInverse, 'CC') }]}>
              Last online: {offlineDuration} ago
            </Text>
          )}
        </View>
        {showPendingCount && hasPendingActions && (
          <View style={[styles.pendingBadge, { backgroundColor: theme.colors.textInverse }]}>
            <Text style={[styles.pendingText, { color: theme.colors.text }]}>{pendingActions}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Compact offline indicator for use in headers.
 */
export function OfflineChip() {
  const theme = useTheme();
  const { isOffline, pendingActions } = useOfflineIndicator();

  if (!isOffline) return null;

  return (
    <View style={[styles.chip, { backgroundColor: theme.colors.warning }]}>
      <Ionicons name="cloud-offline" size={12} color={theme.colors.textInverse} />
      <Text style={[styles.chipText, { color: theme.colors.textInverse }]}>Offline</Text>
      {pendingActions > 0 && (
        <View style={[styles.chipBadge, { backgroundColor: theme.colors.textInverse }]}>
          <Text style={[styles.chipBadgeText, { color: theme.colors.text }]}>{pendingActions}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Full-screen offline state for when content cannot be displayed.
 */
interface OfflineScreenProps {
  title?: string;
  message?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  cachedDataAvailable?: boolean;
  onUseCached?: () => void;
}

export function OfflineScreen({
  title = "You're Offline",
  message = "Please check your internet connection and try again.",
  showRetry = true,
  onRetry,
  cachedDataAvailable = false,
  onUseCached,
}: OfflineScreenProps) {
  const theme = useTheme();
  const { pendingActions } = useOfflineIndicator();

  return (
    <View style={[styles.offlineScreen, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.offlineIconContainer, { backgroundColor: withAlpha(theme.colors.text, '0D') }]}>
        <Ionicons name="cloud-offline" size={64} color={theme.colors.textMuted} />
      </View>

      <Text style={[styles.offlineTitle, { color: theme.colors.text }]}>
        {title}
      </Text>

      <Text style={[styles.offlineMessage, { color: theme.colors.textSecondary }]}>
        {message}
      </Text>

      {pendingActions > 0 && (
        <View style={[styles.pendingInfo, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="time" size={20} color={theme.colors.warning} />
          <Text style={[styles.pendingInfoText, { color: theme.colors.text }]}>
            {pendingActions} action{pendingActions > 1 ? 's' : ''} will sync when you're back online
          </Text>
        </View>
      )}

      <View style={styles.offlineActions}>
        {showRetry && onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Ionicons name="refresh" size={20} color={theme.colors.text} />
            <Text style={[styles.retryButtonText, { color: theme.colors.text }]}>Try Again</Text>
          </TouchableOpacity>
        )}

        {cachedDataAvailable && onUseCached && (
          <TouchableOpacity
            onPress={onUseCached}
            style={[styles.cachedButton, { borderColor: theme.colors.border }]}
          >
            <Ionicons name="folder-open" size={20} color={theme.colors.text} />
            <Text style={[styles.cachedButtonText, { color: theme.colors.text }]}>
              View Cached Data
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Sync status indicator for showing sync progress.
 */
interface SyncStatusProps {
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
}

export function SyncStatus({ isSyncing, lastSyncAt, pendingCount }: SyncStatusProps) {
  const theme = useTheme();

  const getLastSyncText = () => {
    if (!lastSyncAt) return 'Never synced';

    const diff = Date.now() - lastSyncAt;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return 'Over a day ago';
  };

  return (
    <View style={[styles.syncStatus, { backgroundColor: theme.colors.surface }]}>
      {isSyncing ? (
        <>
          <Animated.View style={styles.syncSpinner}>
            <Ionicons name="sync" size={16} color={theme.colors.primary} />
          </Animated.View>
          <Text style={[styles.syncText, { color: theme.colors.textSecondary }]}>
            Syncing...
          </Text>
        </>
      ) : (
        <>
          <Ionicons
            name={pendingCount > 0 ? 'cloud-upload' : 'checkmark-circle'}
            size={16}
            color={pendingCount > 0 ? theme.colors.warning : theme.colors.success}
          />
          <Text style={[styles.syncText, { color: theme.colors.textSecondary }]}>
            {pendingCount > 0
              ? `${pendingCount} pending`
              : `Synced ${getLastSyncText()}`}
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * Message status indicator for offline messages.
 */
interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  onRetry?: () => void;
}

export function MessageStatus({ status, onRetry }: MessageStatusProps) {
  const theme = useTheme();

  const getStatusIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'sending':
        return 'time-outline';
      case 'sent':
        return 'checkmark';
      case 'delivered':
        return 'checkmark-done';
      case 'read':
        return 'checkmark-done';
      case 'failed':
        return 'alert-circle';
      default:
        return 'ellipse';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'sending':
        return theme.colors.textMuted;
      case 'sent':
      case 'delivered':
        return theme.colors.textSecondary;
      case 'read':
        return theme.colors.primary;
      case 'failed':
        return theme.colors.error;
      default:
        return theme.colors.textMuted;
    }
  };

  if (status === 'failed' && onRetry) {
    return (
      <TouchableOpacity onPress={onRetry} style={styles.messageStatus}>
        <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
        <Text style={[styles.retryText, { color: theme.colors.error }]}>
          Tap to retry
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Ionicons name={getStatusIcon()} size={14} color={getStatusColor()} />
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bannerSubtitle: {
    fontSize: 12,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 2,
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  offlineScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  offlineIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  offlineMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  pendingInfoText: {
    flex: 1,
    fontSize: 14,
  },
  offlineActions: {
    gap: 12,
    width: '100%',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cachedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cachedButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  syncSpinner: {
    // Add rotation animation if needed
  },
  syncText: {
    fontSize: 12,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryText: {
    fontSize: 11,
  },
});

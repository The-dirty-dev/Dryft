import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBlockedUsers } from '../../hooks/useModeration';
import { BlockedUser, BLOCK_REASONS } from '../../services/moderation';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

interface BlockedUsersScreenProps {
  onBack?: () => void;
}

// ============================================================================
// Blocked User Item Component
// ============================================================================

interface BlockedUserItemProps {
  user: BlockedUser;
  onUnblock: (userId: string) => void;
  isUnblocking: boolean;
}

function BlockedUserItem({ user, onUnblock, isUnblocking }: BlockedUserItemProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleUnblock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      `Unblock ${user.userName}?`,
      'They will be able to see your profile and message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => onUnblock(user.userId),
        },
      ]
    );
  };

  return (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        {user.userPhoto ? (
          <Image source={{ uri: user.userPhoto }} style={styles.userPhoto} />
        ) : (
          <View style={styles.userPhotoPlaceholder}>
            <Ionicons name="person" size={24} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.userDetails}>
          <Text style={styles.userName}>{user.userName}</Text>
          <Text style={styles.blockedDate}>
            Blocked {formatDate(user.blockedAt)}
          </Text>
          {user.reason && (
            <Text style={styles.blockReason}>
              {BLOCK_REASONS[user.reason]}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.unblockButton}
        onPress={handleUnblock}
        disabled={isUnblocking}
      >
        {isUnblocking ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={styles.unblockButtonText}>Unblock</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="ban-outline" size={48} color={colors.borderLight} />
      </View>
      <Text style={styles.emptyTitle}>No Blocked Users</Text>
      <Text style={styles.emptyMessage}>
        When you block someone, they'll appear here. Blocked users can't see
        your profile or message you.
      </Text>
    </View>
  );
}

// ============================================================================
// Blocked Users Screen Component
// ============================================================================

export function BlockedUsersScreen({ onBack }: BlockedUsersScreenProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { blockedUsers, blockedCount, isLoading, unblockUser } = useBlockedUsers();
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleUnblock = async (userId: string) => {
    setUnblockingId(userId);
    const success = await unblockUser(userId);
    setUnblockingId(null);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Error', 'Failed to unblock user. Please try again.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // In a real app, you'd refresh from the server here
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <BlockedUserItem
      user={item}
      onUnblock={handleUnblock}
      isUnblocking={unblockingId === item.userId}
    />
  );

  const keyExtractor = (item: BlockedUser) => item.userId;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Count Badge */}
      {blockedCount > 0 && (
        <View style={styles.countBadge}>
          <Ionicons name="ban" size={16} color={colors.error} />
          <Text style={styles.countText}>
            {blockedCount} {blockedCount === 1 ? 'user' : 'users'} blocked
          </Text>
        </View>
      )}

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={colors.accent} />
        <Text style={styles.infoBannerText}>
          Blocked users cannot see your profile, send you messages, or match
          with you.
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={blockedUsers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          blockedUsers.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundDarkest,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.error, '1A'),
    paddingVertical: 12,
    gap: 8,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundDarkest,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  userPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 13,
    color: colors.textMuted,
  },
  blockReason: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  unblockButton: {
    backgroundColor: withAlpha(colors.accent, '33'),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.backgroundDarkest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  emptyMessage: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default BlockedUsersScreen;

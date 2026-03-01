import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  useNotifications,
  useNotificationHelpers,
} from '../hooks/useNotificationCenter';
import { Notification, NotificationGroup } from '../services/notificationCenter';

// ============================================================================
// Notification Item Component
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
  onDelete: () => void;
  onMarkRead: () => void;
}

function NotificationItem({
  notification,
  onPress,
  onDelete,
  onMarkRead,
}: NotificationItemProps) {
  const { getIcon, getColor } = useNotificationHelpers();
  const icon = getIcon(notification.type);
  const color = getColor(notification.type);

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.deleteAction]}
        onPress={onDelete}
      >
        <Ionicons name="trash" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !notification.isRead && styles.notificationUnread,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onMarkRead();
          onPress();
        }}
        activeOpacity={0.8}
      >
        {/* Icon */}
        <View style={[styles.notificationIcon, { backgroundColor: `${color}20` }]}>
          {notification.imageUrl ? (
            <Image
              source={{ uri: notification.imageUrl }}
              style={styles.notificationImage}
            />
          ) : (
            <Ionicons name={icon as any} size={22} color={color} />
          )}
        </View>

        {/* Content */}
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={[
                styles.notificationTitle,
                !notification.isRead && styles.notificationTitleUnread,
              ]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <Text style={styles.notificationTime}>
              {formatTime(notification.createdAt)}
            </Text>
          </View>
          <Text style={styles.notificationBody} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>

        {/* Unread indicator */}
        {!notification.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    </Swipeable>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  label: string;
}

function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-off-outline" size={48} color="#4B5563" />
      </View>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyMessage}>
        When you get new matches, messages, or likes, they'll appear here.
      </Text>
    </View>
  );
}

// ============================================================================
// Notification Center Screen
// ============================================================================

interface NotificationCenterScreenProps {
  onBack?: () => void;
  onNotificationPress?: (notification: Notification) => void;
}

export function NotificationCenterScreen({
  onBack,
  onNotificationPress,
}: NotificationCenterScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    groupedNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    markAllAsRead();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            clearAll();
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification: Notification) => {
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
    // Default: navigate based on deepLink or type
  };

  const handleDelete = (notificationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deleteNotification(notificationId);
  };

  // Flatten grouped notifications for FlatList
  const flatData: Array<{ type: 'header' | 'item'; data: any }> = [];
  const seenHeaders = new Set<string>();

  groupedNotifications.forEach((group) => {
    if (!seenHeaders.has(group.label)) {
      flatData.push({ type: 'header', data: group.label });
      seenHeaders.add(group.label);
    }
    group.notifications.forEach((notification) => {
      flatData.push({ type: 'item', data: notification });
    });
  });

  const renderItem = ({ item }: { item: { type: 'header' | 'item'; data: any } }) => {
    if (item.type === 'header') {
      return <SectionHeader label={item.data} />;
    }

    return (
      <NotificationItem
        notification={item.data}
        onPress={() => handleNotificationPress(item.data)}
        onDelete={() => handleDelete(item.data.id)}
        onMarkRead={() => markAsRead(item.data.id)}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            Alert.alert('Options', undefined, [
              { text: 'Mark All as Read', onPress: handleMarkAllRead },
              { text: 'Clear All', onPress: handleClearAll, style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Unread Count Badge */}
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.unreadBadge} onPress={handleMarkAllRead}>
          <Text style={styles.unreadBadgeText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.markAllReadText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      {/* Notifications List */}
      <FlatList
        data={flatData}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          item.type === 'header' ? `header_${item.data}` : item.data.id
        }
        contentContainerStyle={[
          styles.listContent,
          flatData.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor="#8B5CF6"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    color: '#fff',
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  unreadBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  markAllReadText: {
    fontSize: 13,
    color: '#8B5CF6',
  },
  listContent: {
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: '#0a0a0a',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  notificationUnread: {
    backgroundColor: '#0f0f0f',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  notificationImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  notificationBody: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
    marginLeft: 8,
  },
  swipeActions: {
    flexDirection: 'row',
  },
  swipeAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: {
    backgroundColor: '#EF4444',
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
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  emptyMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default NotificationCenterScreen;

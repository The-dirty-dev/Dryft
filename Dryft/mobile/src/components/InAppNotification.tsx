import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
  TextInput,
  Keyboard,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { NotificationData, NotificationCategory } from '../services/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const AUTO_DISMISS_DURATION = 5000;

export interface InAppNotificationData {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  avatarUrl?: string;
  category?: NotificationCategory;
  data?: NotificationData;
  actions?: NotificationActionButton[];
  showQuickReply?: boolean;
}

interface NotificationActionButton {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}

interface InAppNotificationProps {
  notification: InAppNotificationData | null;
  onDismiss: () => void;
  onPress?: (notification: InAppNotificationData) => void;
  onAction?: (actionId: string, notification: InAppNotificationData, input?: string) => void;
}

export function InAppNotification({
  notification,
  onDismiss,
  onPress,
  onAction,
}: InAppNotificationProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const translateY = useRef(new Animated.Value(-200)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isReplying,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !isReplying && (Math.abs(gestureState.dx) > 10 || gestureState.dy < -10),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        } else {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          dismiss();
        } else if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
          dismissHorizontal(gestureState.dx > 0 ? 1 : -1);
        } else {
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const dismiss = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsExpanded(false);
      setIsReplying(false);
      setReplyText('');
      translateX.setValue(0);
      onDismiss();
    });
  }, [onDismiss]);

  const dismissHorizontal = useCallback(
    (direction: number) => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH * direction,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsExpanded(false);
        setIsReplying(false);
        setReplyText('');
        translateY.setValue(-200);
        translateX.setValue(0);
        onDismiss();
      });
    },
    [onDismiss]
  );

  const resetDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
    if (!isExpanded && !isReplying) {
      dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_DURATION);
    }
  }, [dismiss, isExpanded, isReplying]);

  useEffect(() => {
    if (notification) {
      translateY.setValue(-200);
      translateX.setValue(0);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      resetDismissTimer();
    }

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, [notification, resetDismissTimer]);

  const handlePress = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
    onPress?.(notification!);
    dismiss();
  };

  const handleLongPress = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
    setIsExpanded(true);
  };

  const handleAction = (actionId: string) => {
    if (actionId === 'reply' && notification?.showQuickReply) {
      setIsReplying(true);
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    onAction?.(actionId, notification!, undefined);
    dismiss();
  };

  const handleSendReply = () => {
    if (replyText.trim()) {
      onAction?.('reply', notification!, replyText.trim());
      dismiss();
    }
  };

  if (!notification) return null;

  const getCategoryColor = (category?: NotificationCategory): string => {
    switch (category) {
      case 'MESSAGE':
        return theme.colors.primary;
      case 'MATCH':
        return '#e94560';
      case 'LIKE':
      case 'SUPER_LIKE':
        return '#ff6b9d';
      case 'VR_INVITE':
        return '#9b59b6';
      case 'SAFETY':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  const categoryColor = getCategoryColor(notification.category);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderLeftColor: categoryColor,
            },
          ]}
        >
          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Avatar/Image */}
            {(notification.avatarUrl || notification.imageUrl) && (
              <Image
                source={{ uri: notification.avatarUrl || notification.imageUrl }}
                style={[
                  notification.avatarUrl ? styles.avatar : styles.image,
                  !!notification.avatarUrl && { borderColor: categoryColor },
                ]}
              />
            )}

            {/* Text Content */}
            <View style={styles.textContent}>
              <Text
                style={[styles.title, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              <Text
                style={[styles.body, { color: theme.colors.textSecondary }]}
                numberOfLines={isExpanded ? 4 : 2}
              >
                {notification.body}
              </Text>
            </View>

            {/* App Icon */}
            <View style={[styles.appIcon, { backgroundColor: categoryColor }]}>
              <Text style={styles.appIconText}>D</Text>
            </View>
          </View>

          {/* Attachment Image */}
          {notification.imageUrl && !notification.avatarUrl && isExpanded && (
            <Image
              source={{ uri: notification.imageUrl }}
              style={styles.attachmentImage}
              resizeMode="cover"
            />
          )}

          {/* Quick Reply Input */}
          {isReplying && (
            <View style={[styles.replyContainer, { borderTopColor: theme.colors.border }]}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.replyInput,
                  {
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.textMuted}
                value={replyText}
                onChangeText={setReplyText}
                onSubmitEditing={handleSendReply}
                returnKeyType="send"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: replyText.trim() ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={handleSendReply}
                disabled={!replyText.trim()}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons */}
          {isExpanded && !isReplying && notification.actions && (
            <View style={[styles.actionsContainer, { borderTopColor: theme.colors.border }]}>
              {notification.actions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionButton}
                  onPress={() => handleAction(action.id)}
                >
                  {action.icon && (
                    <Ionicons
                      name={action.icon}
                      size={18}
                      color={action.destructive ? theme.colors.error : theme.colors.primary}
                    />
                  )}
                  <Text
                    style={[
                      styles.actionLabel,
                      {
                        color: action.destructive ? theme.colors.error : theme.colors.primary,
                      },
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {notification.showQuickReply && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleAction('reply')}
                >
                  <Ionicons name="chatbubble" size={18} color={theme.colors.primary} />
                  <Text style={[styles.actionLabel, { color: theme.colors.primary }]}>
                    Reply
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Dismiss Indicator */}
          <View style={[styles.dismissIndicator, { backgroundColor: theme.colors.border }]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Hook for managing in-app notifications
 */
export function useInAppNotifications() {
  const [notification, setNotification] = useState<InAppNotificationData | null>(null);
  const queue = useRef<InAppNotificationData[]>([]);

  const showNotification = useCallback((data: InAppNotificationData) => {
    if (notification) {
      queue.current.push(data);
    } else {
      setNotification(data);
    }
  }, [notification]);

  const dismissNotification = useCallback(() => {
    setNotification(null);

    // Show next notification in queue
    setTimeout(() => {
      if (queue.current.length > 0) {
        const next = queue.current.shift();
        if (next) {
          setNotification(next);
        }
      }
    }, 300);
  }, []);

  const clearQueue = useCallback(() => {
    queue.current = [];
    setNotification(null);
  }, []);

  return {
    notification,
    showNotification,
    dismissNotification,
    clearQueue,
  };
}

/**
 * Create notification data for common scenarios
 */
export const createNotificationData = {
  message: (
    senderName: string,
    message: string,
    matchId: string,
    avatarUrl?: string
  ): InAppNotificationData => ({
    id: `msg_${Date.now()}`,
    title: senderName,
    body: message,
    avatarUrl,
    category: 'MESSAGE',
    data: {
      type: 'new_message',
      match_id: matchId,
      user_name: senderName,
      message_preview: message,
    },
    showQuickReply: true,
    actions: [
      { id: 'mark_read', label: 'Mark Read', icon: 'checkmark-done' },
    ],
  }),

  match: (
    matchName: string,
    matchId: string,
    userId: string,
    avatarUrl?: string
  ): InAppNotificationData => ({
    id: `match_${Date.now()}`,
    title: "It's a Match!",
    body: `You and ${matchName} liked each other`,
    avatarUrl,
    category: 'MATCH',
    data: {
      type: 'new_match',
      match_id: matchId,
      user_id: userId,
      user_name: matchName,
    },
    actions: [
      { id: 'say_hi', label: 'Say Hi', icon: 'chatbubble' },
      { id: 'view_profile', label: 'View', icon: 'person' },
    ],
  }),

  like: (
    likerName: string,
    userId: string,
    isSuperLike: boolean = false,
    avatarUrl?: string
  ): InAppNotificationData => ({
    id: `like_${Date.now()}`,
    title: isSuperLike ? `${likerName} Super Liked you!` : `${likerName} liked you`,
    body: isSuperLike ? 'They really want to meet you!' : 'Swipe right to match',
    avatarUrl,
    category: isSuperLike ? 'SUPER_LIKE' : 'LIKE',
    data: {
      type: isSuperLike ? 'super_like' : 'new_like',
      user_id: userId,
      user_name: likerName,
    },
    actions: [
      { id: 'like_back', label: 'Like Back', icon: 'heart' },
      { id: 'view_profile', label: 'View', icon: 'person' },
      { id: 'pass', label: 'Pass', icon: 'close', destructive: true },
    ],
  }),

  vrInvite: (
    inviterName: string,
    sessionCode: string,
    avatarUrl?: string
  ): InAppNotificationData => ({
    id: `vr_${Date.now()}`,
    title: `${inviterName} invited you to VR`,
    body: 'Tap to join their VR session',
    avatarUrl,
    category: 'VR_INVITE',
    data: {
      type: 'vr_invite',
      session_code: sessionCode,
      partner_name: inviterName,
    },
    actions: [
      { id: 'join_vr', label: 'Join', icon: 'glasses' },
      { id: 'decline_vr', label: 'Decline', icon: 'close', destructive: true },
    ],
  }),
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 16,
    borderLeftWidth: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    lineHeight: 18,
  },
  appIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  attachmentImage: {
    width: '100%',
    height: 150,
    marginTop: -8,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  dismissIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
});

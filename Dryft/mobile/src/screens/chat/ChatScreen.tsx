import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMatchingStore } from '../../store/matchingStore';
import { useAuthStore } from '../../store/authStore';
import { useChatSocket } from '../../hooks/useChatSocket';
import { Message, UserPublicProfile } from '../../types';
import { RootStackParamList } from '../../navigation';
import { Input } from '../../components/common';
import { useColors, ThemeColors } from '../../theme/ThemeProvider';

type ChatRouteProp = RouteProp<{ Chat: { matchId: string; user: UserPublicProfile } }, 'Chat'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChatScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colors = useColors();
  const styles = createStyles(colors);
  const route = useRoute<ChatRouteProp>();
  const { matchId, user } = route.params;
  const { user: currentUser } = useAuthStore();
  const {
    currentMessages,
    isLoadingMessages,
    isSendingMessage,
    loadMessages,
    addMessage,
    markAsRead,
    currentConversationId,
    setCurrentConversationId,
  } = useMatchingStore();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // WebSocket handlers
  const handleNewMessage = useCallback((payload: any) => {
    if (payload.conversation_id === currentConversationId) {
      // Add message to local state
      const newMessage: Message = {
        id: payload.id,
        conversation_id: payload.conversation_id,
        sender_id: payload.sender_id,
        type: payload.type,
        content: payload.content,
        created_at: new Date(payload.created_at).toISOString(),
      };
      addMessage(newMessage);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentConversationId, addMessage]);

  const handleTyping = useCallback((payload: any) => {
    if (payload.conversation_id === currentConversationId && payload.user_id !== currentUser?.id) {
      setOtherUserTyping(payload.is_typing);
    }
  }, [currentConversationId, currentUser?.id]);

  const handlePresence = useCallback((payload: any) => {
    if (payload.user_id === user.id) {
      setIsOnline(payload.is_online);
    }
  }, [user.id]);

  const handleMessagesRead = useCallback((payload: any) => {
    if (payload.conversation_id === currentConversationId) {
      // Could update message read status here
    }
  }, [currentConversationId]);

  const {
    isConnected,
    subscribe,
    unsubscribe,
    sendMessage: sendViaSocket,
    startTyping,
    stopTyping,
    markRead,
  } = useChatSocket({
    onNewMessage: handleNewMessage,
    onTyping: handleTyping,
    onPresence: handlePresence,
    onMessagesRead: handleMessagesRead,
  });

  useEffect(() => {
    // Load initial messages
    loadMessages(matchId);
    markAsRead(matchId);

    // Get conversation ID and subscribe
    // In a real app, you'd fetch this from the API
    if (currentConversationId) {
      subscribe(currentConversationId);
      markRead(currentConversationId);
    }

    return () => {
      if (currentConversationId) {
        unsubscribe(currentConversationId);
      }
    };
  }, [matchId, currentConversationId]);

  // Handle typing indicator
  const handleInputChange = (text: string) => {
    setInputText(text);

    // Send typing indicator via WebSocket
    if (currentConversationId && isConnected) {
      if (!isTyping && text.length > 0) {
        setIsTyping(true);
        startTyping(currentConversationId);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          setIsTyping(false);
          stopTyping(currentConversationId);
        }
      }, 2000);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSendingMessage) return;

    const text = inputText.trim();
    setInputText('');

    // Stop typing indicator
    if (isTyping && currentConversationId) {
      setIsTyping(false);
      stopTyping(currentConversationId);
    }

    // Send via WebSocket if connected, otherwise fall back to REST
    if (isConnected && currentConversationId) {
      try {
        const result = await sendViaSocket(currentConversationId, text);
        // Optimistically add message to local state
        const newMessage: Message = {
          id: result.id,
          conversation_id: currentConversationId,
          sender_id: currentUser?.id || '',
          type: 'text',
          content: text,
          created_at: new Date(result.created_at).toISOString(),
        };
        addMessage(newMessage);
      } catch (error) {
        console.error('Failed to send via WebSocket:', error);
        // Fall back to REST API
        await useMatchingStore.getState().sendMessage(matchId, text);
      }
    } else {
      // Use REST API
      await useMatchingStore.getState().sendMessage(matchId, text);
    }

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const shouldShowDate = (currentMsg: Message, previousMsg?: Message) => {
    if (!previousMsg) return true;
    const currentDate = new Date(currentMsg.created_at).toDateString();
    const previousDate = new Date(previousMsg.created_at).toDateString();
    return currentDate !== previousDate;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === currentUser?.id;
    const previousMessage = currentMessages[index - 1];
    const showDate = shouldShowDate(item, previousMessage);

    return (
      <>
        {showDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isMe ? styles.messageContainerMe : styles.messageContainerThem,
          ]}
        >
          {!isMe && (
            <Image
              source={{ uri: user.profile_photo || 'https://via.placeholder.com/40' }}
              style={styles.messageAvatar}
            />
          )}
          <View
            style={[
              styles.messageBubble,
              isMe ? styles.messageBubbleMe : styles.messageBubbleThem,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMe ? styles.messageTextMe : styles.messageTextThem,
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isMe ? styles.messageTimeMe : styles.messageTimeThem,
              ]}
            >
              {formatTime(item.created_at)}
              {isMe && item.read_at && ' ✓✓'}
            </Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerProfile}>
          <Image
            source={{ uri: user.profile_photo || 'https://via.placeholder.com/40' }}
            style={styles.headerPhoto}
          />
          <View>
            <Text style={styles.headerName}>{user.display_name}</Text>
            <Text style={[styles.headerStatus, !isOnline && styles.headerStatusOffline]}>
              {otherUserTyping ? 'typing...' : isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('MessageSearch', {
              conversationId: currentConversationId,
              matchId,
              userName: user.display_name,
            })
          }
        >
          <Text style={styles.searchButton}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.menuButton}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoadingMessages && currentMessages.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image
                source={{ uri: user.profile_photo || 'https://via.placeholder.com/100' }}
                style={styles.emptyPhoto}
              />
              <Text style={styles.emptyTitle}>
                You matched with {user.display_name}!
              </Text>
              <Text style={styles.emptySubtitle}>
                Say something nice to start the conversation
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <Input
          style={styles.input}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSendingMessage}
        >
          {isSendingMessage ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.sendButtonText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  backButton: {
    fontSize: 28,
    color: colors.text,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16,
  },
  headerPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.like,
  },
  headerStatusOffline: {
    color: colors.textSecondary,
  },
  searchButton: {
    fontSize: 20,
    color: colors.text,
    marginRight: 12,
  },
  menuButton: {
    fontSize: 24,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  messageContainerMe: {
    justifyContent: 'flex-end',
  },
  messageContainerThem: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleThem: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMe: {
    color: colors.text,
  },
  messageTextThem: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeMe: {
    color: `${colors.text}B3`,
    textAlign: 'right',
  },
  messageTimeThem: {
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 12,
    fontSize: 16,
    color: colors.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
  },
  sendButtonText: {
    fontSize: 20,
    color: colors.text,
  },
});

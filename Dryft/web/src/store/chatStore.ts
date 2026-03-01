import { create } from 'zustand';
import { apiClient } from '@/lib/api';
import { Conversation, ConversationsResponse, Message, MessagesResponse } from '@/types';

interface ChatState {
  // Conversations
  conversations: Conversation[];
  isLoadingConversations: boolean;
  conversationsError: string | null;

  // Current conversation messages
  currentConversationId: string | null;
  messages: Message[];
  isLoadingMessages: boolean;
  messagesError: string | null;

  // Sending state
  isSendingMessage: boolean;

  // Typing indicators (from WebSocket)
  typingUsers: Record<string, boolean>;

  // Actions
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, type?: 'text' | 'image' | 'gif') => Promise<boolean>;
  markAsRead: (conversationId: string) => Promise<void>;
  setCurrentConversation: (conversationId: string | null) => void;
  addMessage: (message: Message) => void;
  updateTypingStatus: (conversationId: string, userId: string, isTyping: boolean) => void;
  updateConversationLastMessage: (conversationId: string, message: Message) => void;
  removeConversation: (conversationId: string) => void;
  reset: () => void;
}

const initialState = {
  conversations: [],
  isLoadingConversations: false,
  conversationsError: null,
  currentConversationId: null,
  messages: [],
  isLoadingMessages: false,
  messagesError: null,
  isSendingMessage: false,
  typingUsers: {},
};

/**
 * Zustand store for conversations and message state.
 * @returns Chat state and async loaders for conversations/messages.
 * @example
 * const { conversations, loadConversations } = useChatStore();
 */
export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  loadConversations: async () => {
    set({ isLoadingConversations: true, conversationsError: null });
    try {
      const response = await apiClient.get<ConversationsResponse>('/v1/conversations');
      if (response.success && response.data) {
        set({
          conversations: response.data.conversations || [],
          isLoadingConversations: false,
        });
      } else {
        set({
          conversationsError: response.error || 'Failed to load conversations',
          isLoadingConversations: false,
        });
      }
    } catch (error) {
      console.error('[chatStore] Failed to load conversations:', error);
      set({
        conversationsError: error instanceof Error ? error.message : 'Network error',
        isLoadingConversations: false,
      });
    }
  },

  loadMessages: async (conversationId: string) => {
    set({ isLoadingMessages: true, messagesError: null, currentConversationId: conversationId });
    try {
      const response = await apiClient.get<MessagesResponse>(
        `/v1/conversations/${conversationId}/messages`
      );
      if (response.success && response.data) {
        set({
          messages: response.data.messages || [],
          isLoadingMessages: false,
        });
      } else {
        set({
          messagesError: response.error || 'Failed to load messages',
          isLoadingMessages: false,
        });
      }
    } catch (error) {
      console.error('[chatStore] Failed to load messages:', error);
      set({
        messagesError: error instanceof Error ? error.message : 'Network error',
        isLoadingMessages: false,
      });
    }
  },

  sendMessage: async (conversationId: string, content: string, type: 'text' | 'image' | 'gif' = 'text') => {
    set({ isSendingMessage: true });
    try {
      const response = await apiClient.post<Message>(`/v1/conversations/${conversationId}/messages`, {
        content,
        content_type: type,
      });
      if (response.success && response.data) {
        const newMessage = response.data;
        set((state) => ({
          messages: [...state.messages, newMessage],
          isSendingMessage: false,
        }));
        // Update conversation's last message
        get().updateConversationLastMessage(conversationId, newMessage);
        return true;
      }
      set({ isSendingMessage: false });
      return false;
    } catch (error) {
      console.error('[chatStore] Failed to send message:', error);
      set({ isSendingMessage: false });
      return false;
    }
  },

  markAsRead: async (conversationId: string) => {
    try {
      await apiClient.post(`/v1/conversations/${conversationId}/read`);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ),
      }));
    } catch (error) {
      console.error('[chatStore] Failed to mark as read:', error);
    }
  },

  setCurrentConversation: (conversationId: string | null) => {
    set({ currentConversationId: conversationId, messages: [] });
  },

  addMessage: (message: Message) => {
    const { currentConversationId } = get();
    if (message.conversation_id === currentConversationId) {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    }
    // Update conversation's last message and unread count
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === message.conversation_id
          ? {
              ...c,
              last_message: {
                id: message.id,
                sender_id: message.sender_id,
                type: message.type,
                preview: message.content.substring(0, 100),
                created_at: message.created_at,
                is_read: !!message.read_at,
              },
              unread_count: c.id === currentConversationId ? c.unread_count : c.unread_count + 1,
            }
          : c
      ),
    }));
  },

  updateTypingStatus: (conversationId: string, userId: string, isTyping: boolean) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [`${conversationId}:${userId}`]: isTyping,
      },
    }));
  },

  updateConversationLastMessage: (conversationId: string, message: Message) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              last_message: {
                id: message.id,
                sender_id: message.sender_id,
                type: message.type,
                preview: message.content.substring(0, 100),
                created_at: message.created_at,
                is_read: !!message.read_at,
              },
              updated_at: message.created_at,
            }
          : c
      ),
    }));
  },

  removeConversation: (conversationId: string) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
    }));
  },

  reset: () => set(initialState),
}));

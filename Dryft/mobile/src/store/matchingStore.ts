import { create } from 'zustand';
import { api } from '../services/api';
import {
  DiscoverProfile,
  Match,
  Conversation,
  Message,
  SwipeResult,
} from '../types';

interface MatchingState {
  // Discover
  discoverProfiles: DiscoverProfile[];
  currentProfileIndex: number;
  isLoadingDiscover: boolean;

  // Matches
  matches: Match[];
  isLoadingMatches: boolean;

  // Chat
  conversations: Conversation[];
  isLoadingConversations: boolean;
  currentMessages: Message[];
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  currentConversationId: string | null;

  // Actions
  loadDiscoverProfiles: () => Promise<void>;
  swipe: (userId: string, direction: 'like' | 'pass') => Promise<SwipeResult | null>;
  nextProfile: () => void;

  loadMatches: () => Promise<void>;
  unmatch: (matchId: string) => Promise<boolean>;

  loadConversations: () => Promise<void>;
  loadMessages: (matchId: string) => Promise<void>;
  sendMessage: (matchId: string, content: string) => Promise<boolean>;
  markAsRead: (matchId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  setCurrentConversationId: (id: string | null) => void;
}

export const useMatchingStore = create<MatchingState>((set, get) => ({
  // Initial state
  discoverProfiles: [],
  currentProfileIndex: 0,
  isLoadingDiscover: false,

  matches: [],
  isLoadingMatches: false,

  conversations: [],
  isLoadingConversations: false,
  currentMessages: [],
  isLoadingMessages: false,
  isSendingMessage: false,
  currentConversationId: null,

  // Discover actions
  loadDiscoverProfiles: async () => {
    set({ isLoadingDiscover: true });
    try {
      const response = await api.get('/v1/discover?limit=20');
      set({
        discoverProfiles: response.data.profiles || [],
        currentProfileIndex: 0,
        isLoadingDiscover: false,
      });
    } catch (error) {
      console.error('Failed to load discover profiles:', error);
      set({ isLoadingDiscover: false });
    }
  },

  swipe: async (userId: string, direction: 'like' | 'pass') => {
    try {
      const response = await api.post('/v1/discover/swipe', {
        user_id: userId,
        direction,
      });
      return response.data as SwipeResult;
    } catch (error) {
      console.error('Failed to swipe:', error);
      return null;
    }
  },

  nextProfile: () => {
    const { currentProfileIndex, discoverProfiles, loadDiscoverProfiles } = get();
    const nextIndex = currentProfileIndex + 1;

    if (nextIndex >= discoverProfiles.length - 3) {
      // Preload more profiles when getting low
      loadDiscoverProfiles();
    }

    set({ currentProfileIndex: nextIndex });
  },

  // Matches actions
  loadMatches: async () => {
    set({ isLoadingMatches: true });
    try {
      const response = await api.get('/v1/matches');
      set({
        matches: response.data.matches || [],
        isLoadingMatches: false,
      });
    } catch (error) {
      console.error('Failed to load matches:', error);
      set({ isLoadingMatches: false });
    }
  },

  unmatch: async (matchId: string) => {
    try {
      await api.delete(`/v1/matches/${matchId}`);
      set((state) => ({
        matches: state.matches.filter((m) => m.id !== matchId),
        conversations: state.conversations.filter((c) => c.match_id !== matchId),
      }));
      return true;
    } catch (error) {
      console.error('Failed to unmatch:', error);
      return false;
    }
  },

  // Chat actions
  loadConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const response = await api.get('/v1/chat/conversations');
      set({
        conversations: response.data.conversations || [],
        isLoadingConversations: false,
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (matchId: string) => {
    set({ isLoadingMessages: true, currentMessages: [] });
    try {
      const response = await api.get(`/v1/chat/${matchId}/messages`);
      set({
        currentMessages: response.data.messages || [],
        isLoadingMessages: false,
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (matchId: string, content: string) => {
    set({ isSendingMessage: true });
    try {
      const response = await api.post(`/v1/chat/${matchId}/messages`, {
        content,
        type: 'text',
      });
      const newMessage = response.data as Message;
      set((state) => ({
        currentMessages: [...state.currentMessages, newMessage],
        isSendingMessage: false,
      }));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      set({ isSendingMessage: false });
      return false;
    }
  },

  markAsRead: async (matchId: string) => {
    try {
      await api.post(`/v1/chat/${matchId}/read`);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.match_id === matchId ? { ...c, unread_count: 0 } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },

  addMessage: (message: Message) => {
    set((state) => ({
      currentMessages: [...state.currentMessages, message],
    }));
  },

  setCurrentConversationId: (id: string | null) => {
    set({ currentConversationId: id });
  },
}));

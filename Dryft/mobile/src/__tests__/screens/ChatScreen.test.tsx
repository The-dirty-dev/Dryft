import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ChatScreen from '../../screens/chat/ChatScreen';

jest.mock('../../store/matchingStore', () => ({
  useMatchingStore: () => ({
    currentMessages: [],
    isLoadingMessages: false,
    isSendingMessage: false,
    loadMessages: jest.fn(),
    addMessage: jest.fn(),
    markAsRead: jest.fn(),
    currentConversationId: 'conv-1',
    setCurrentConversationId: jest.fn(),
  }),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

jest.mock('../../hooks/useChatSocket', () => ({
  useChatSocket: () => ({
    isConnected: false,
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    sendMessage: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    markRead: jest.fn(),
  }),
}));

describe('ChatScreen', () => {
  it('renders chat input', () => {
    (global as any).__mockRoute = {
      params: {
        matchId: 'match-1',
        user: { id: 'user-2', display_name: 'Jamie', profile_photo: null },
      },
    };

    render(<ChatScreen />);

    expect(screen.getByPlaceholderText('Type a message...')).toBeTruthy();
  });
});

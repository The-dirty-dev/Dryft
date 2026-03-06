import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ChatScreen from '../../screens/chat/ChatScreen';

const mockLoadMessages = jest.fn();
const mockSendMessage = jest.fn(async () => true);

jest.mock('../../store/matchingStore', () => {
  const useMatchingStore: any = () => (global as any).__mockChatState;
  useMatchingStore.getState = () => (global as any).__mockChatState;
  return { useMatchingStore };
});

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
    sendMessage: jest.fn(async () => ({ id: 'socket-msg', created_at: Date.now() })),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    markRead: jest.fn(),
  }),
}));

describe('ChatScreen', () => {
  beforeEach(() => {
    (global as any).__mockChatState = {
      currentMessages: [
        {
          id: 'msg-1',
          sender_id: 'user-2',
          content: 'Hey there',
          created_at: new Date().toISOString(),
          type: 'text',
        },
      ],
      isLoadingMessages: false,
      isSendingMessage: false,
      loadMessages: mockLoadMessages,
      sendMessage: mockSendMessage,
      addMessage: jest.fn(),
      markAsRead: jest.fn(),
      currentConversationId: 'conv-1',
      setCurrentConversationId: jest.fn(),
    };

    (global as any).__mockRoute = {
      params: {
        matchId: 'match-1',
        user: { id: 'user-2', display_name: 'Jamie', profile_photo: null },
      },
    };

    jest.clearAllMocks();
  });

  it('renders message list and chat input', () => {
    render(<ChatScreen />);

    expect(screen.getByText('Jamie')).toBeTruthy();
    expect(screen.getByText('Hey there')).toBeTruthy();
    expect(screen.getByPlaceholderText('Type a message...')).toBeTruthy();
  });

  it('loads messages for the selected match on mount', () => {
    render(<ChatScreen />);

    expect(mockLoadMessages).toHaveBeenCalledWith('match-1');
  });

  it('sends a message when send button is pressed', async () => {
    render(<ChatScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Type a message...'), 'Hello Jamie');
    fireEvent.press(screen.getByText('➤'));

    expect(mockSendMessage).toHaveBeenCalledWith('match-1', 'Hello Jamie');
  });
});

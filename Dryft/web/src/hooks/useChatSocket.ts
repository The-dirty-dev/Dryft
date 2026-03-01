'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import chatSocketService, {
  NewMessagePayload,
  MessageSentPayload,
  TypingIndicatorPayload,
  PresencePayload,
  NewMatchPayload,
  UnmatchedPayload,
  MessagesReadPayload,
  ErrorPayload,
} from '@/lib/chatSocket';

export interface UseChatSocketOptions {
  onNewMessage?: (payload: NewMessagePayload) => void;
  onMessageSent?: (payload: MessageSentPayload) => void;
  onTyping?: (payload: TypingIndicatorPayload) => void;
  onPresence?: (payload: PresencePayload) => void;
  onNewMatch?: (payload: NewMatchPayload) => void;
  onUnmatched?: (payload: UnmatchedPayload) => void;
  onMessagesRead?: (payload: MessagesReadPayload) => void;
  onError?: (payload: ErrorPayload) => void;
}

/**
 * React hook that manages the chat WebSocket lifecycle and exposes messaging helpers.
 * @param options - Optional callbacks for chat/presence events.
 * @returns Connection state and message helpers (subscribe, sendMessage, typing, markRead).
 * @example
 * const { isConnected, subscribe, sendMessage } = useChatSocket({
 *   onNewMessage: (msg) => console.log(msg),
 * });
 * subscribe(conversationId);
 * await sendMessage(conversationId, 'Hello!');
 * @remarks
 * WebSocket events handled: `new_message`, `message_sent`, `typing`, `presence`,
 * `new_match`, `unmatched`, `messages_read`, `error`.
 */
export function useChatSocket(options: UseChatSocketOptions = {}) {
  const { isAuthenticated, token } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const initialized = useRef(false);

  // Store options in ref to avoid effect dependencies
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    // Set up token getter
    chatSocketService.setTokenGetter(() => token);

    if (isAuthenticated && !initialized.current) {
      initialized.current = true;
      initializeSocket();
    }

    return () => {
      if (!isAuthenticated) {
        chatSocketService.disconnect();
        initialized.current = false;
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, token]);

  const initializeSocket = async () => {
    try {
      chatSocketService.setHandlers({
        onConnected: () => {
          setIsConnected(true);
        },
        onDisconnected: () => {
          setIsConnected(false);
        },
        onNewMessage: (payload) => {
          optionsRef.current.onNewMessage?.(payload);
        },
        onMessageSent: (payload) => {
          optionsRef.current.onMessageSent?.(payload);
        },
        onTyping: (payload) => {
          optionsRef.current.onTyping?.(payload);
        },
        onPresence: (payload) => {
          optionsRef.current.onPresence?.(payload);
        },
        onNewMatch: (payload) => {
          optionsRef.current.onNewMatch?.(payload);
        },
        onUnmatched: (payload) => {
          optionsRef.current.onUnmatched?.(payload);
        },
        onMessagesRead: (payload) => {
          optionsRef.current.onMessagesRead?.(payload);
        },
        onError: (payload) => {
          optionsRef.current.onError?.(payload);
        },
      });

      await chatSocketService.connect();
    } catch (error) {
      console.error('[useChatSocket] Failed to connect:', error);
    }
  };

  const subscribe = useCallback((conversationId: string) => {
    chatSocketService.subscribe(conversationId);
  }, []);

  const unsubscribe = useCallback((conversationId: string) => {
    chatSocketService.unsubscribe(conversationId);
  }, []);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      type: 'text' | 'image' | 'gif' = 'text'
    ) => {
      return chatSocketService.sendMessage(conversationId, content, type);
    },
    []
  );

  const startTyping = useCallback((conversationId: string) => {
    chatSocketService.startTyping(conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    chatSocketService.stopTyping(conversationId);
  }, []);

  const markRead = useCallback((conversationId: string) => {
    chatSocketService.markRead(conversationId);
  }, []);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
  };
}

export default useChatSocket;

// Re-export types for convenience
export type {
  NewMessagePayload,
  MessageSentPayload,
  TypingIndicatorPayload,
  PresencePayload,
  NewMatchPayload,
  UnmatchedPayload,
  MessagesReadPayload,
  ErrorPayload,
} from '@/lib/chatSocket';

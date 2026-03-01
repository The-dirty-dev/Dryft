'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Textarea from '@/components/ui/Textarea';
import { useChatSocket } from '@/hooks/useChatSocket';
import apiClient from '@/lib/api';

interface DiscoverProfile {
  id: string;
  display_name: string;
  bio?: string;
  profile_photo?: string;
}

interface Match {
  id: string;
  user: DiscoverProfile;
  matched_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type: 'text' | 'image' | 'haptic';
  read_at?: string;
  created_at: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // WebSocket handlers
  const handleNewMessage = useCallback(
    (payload: { id: string; conversation_id: string; sender_id: string; type: string; content: string; created_at: number }) => {
      if (payload.conversation_id === conversationId) {
        const newMessage: Message = {
          id: payload.id,
          conversation_id: payload.conversation_id,
          sender_id: payload.sender_id,
          content: payload.content,
          content_type: payload.type as 'text' | 'image' | 'haptic',
          created_at: new Date(payload.created_at).toISOString(),
        };
        setMessages((prev) => [...prev, newMessage]);
      }
    },
    [conversationId]
  );

  const handleTyping = useCallback(
    (payload: { conversation_id: string; user_id: string; is_typing: boolean }) => {
      if (payload.conversation_id === conversationId && payload.user_id !== currentUserId) {
        setOtherUserTyping(payload.is_typing);
      }
    },
    [conversationId, currentUserId]
  );

  const handlePresence = useCallback(
    (payload: { user_id: string; is_online: boolean }) => {
      if (match && payload.user_id === match.user.id) {
        setIsOnline(payload.is_online);
      }
    },
    [match]
  );

  const handleMessagesRead = useCallback(
    (payload: { conversation_id: string; reader_id: string; read_at: number }) => {
      if (payload.conversation_id === conversationId && payload.reader_id !== currentUserId) {
        // Mark messages as read
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender_id === currentUserId && !msg.read_at
              ? { ...msg, read_at: new Date(payload.read_at).toISOString() }
              : msg
          )
        );
      }
    },
    [conversationId, currentUserId]
  );

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // Get current user ID
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setCurrentUserId(user.id);
    }

    loadMatch();
    loadMessagesAndConversation();
  }, [matchId]);

  // Subscribe to WebSocket when we have conversation ID
  useEffect(() => {
    if (conversationId && isConnected) {
      subscribe(conversationId);
      markRead(conversationId);

      return () => {
        unsubscribe(conversationId);
      };
    }
  }, [conversationId, isConnected, subscribe, unsubscribe, markRead]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadMatch = async () => {
    const response = await apiClient.get<Match>(`/v1/matches/${matchId}`);
    if (response.success && response.data) {
      setMatch(response.data);
    }
  };

  const loadMessagesAndConversation = async () => {
    try {
      // First get the conversation for this match
      const convResponse = await apiClient.get<{ id: string; messages?: Message[] }>(
        `/v1/matches/${matchId}/conversation`
      );

      if (convResponse.success && convResponse.data) {
        setConversationId(convResponse.data.id);

        // Load messages for this conversation
        const msgResponse = await apiClient.get<{ messages: Message[] }>(
          `/v1/conversations/${convResponse.data.id}/messages`
        );

        if (msgResponse.success && msgResponse.data) {
          setMessages(msgResponse.data.messages || []);
        }

        // Mark as read via REST (WebSocket will also mark read when subscribed)
        await apiClient.post(`/v1/conversations/${convResponse.data.id}/read`, {});
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Send typing indicator via WebSocket
    if (conversationId && isConnected) {
      if (!isTyping && text.length > 0) {
        setIsTyping(true);
        startTyping(conversationId);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping && conversationId) {
          setIsTyping(false);
          stopTyping(conversationId);
        }
      }, 2000);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Stop typing indicator
    if (isTyping && conversationId) {
      setIsTyping(false);
      stopTyping(conversationId);
    }

    // Send via WebSocket if connected, otherwise fall back to REST
    if (isConnected && conversationId) {
      try {
        const result = await sendViaSocket(conversationId, text);
        // Optimistically add message to local state
        const newMessage: Message = {
          id: result.id,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: text,
          content_type: 'text',
          created_at: new Date(result.created_at).toISOString(),
        };
        setMessages((prev) => [...prev, newMessage]);
      } catch (error) {
        console.error('Failed to send via WebSocket:', error);
        // Fall back to REST API
        await sendViaRest(text);
      }
    } else {
      // Use REST API
      await sendViaRest(text);
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  const sendViaRest = async (text: string) => {
    if (!conversationId) return;

    const response = await apiClient.post<Message>(`/v1/conversations/${conversationId}/messages`, {
      content: text,
      type: 'text',
    });

    if (response.success && response.data) {
      setMessages((prev) => [...prev, response.data!]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleUnmatch = async () => {
    const response = await apiClient.delete(`/v1/matches/${matchId}`);
    if (response.success) {
      router.push('/messages');
    }
    setShowUnmatchConfirm(false);
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

  const shouldShowDate = (index: number) => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].created_at).toDateString();
    const previousDate = new Date(messages[index - 1].created_at).toDateString();
    return currentDate !== previousDate;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/messages"
              className="text-muted hover:text-white transition-colors text-xl"
            >
              ←
            </Link>
            {match && (
              <Link href={`/profile/${match.user.id}`} className="flex items-center gap-3">
                <div className="relative w-10 h-10">
                  <Image
                    src={match.user.profile_photo || '/placeholder-avatar.png'}
                    alt={match.user.display_name}
                    fill
                    className="rounded-full object-cover"
                  />
                </div>
                <div>
                  <h1 className="font-semibold text-white">{match.user.display_name}</h1>
                  <p className={`text-xs ${isOnline ? 'text-green-500' : 'text-muted'}`}>
                    {otherUserTyping ? 'typing...' : isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowUnmatchConfirm(true)}
              className="text-muted hover:text-red-500 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10"
              title="Unmatch"
            >
              Unmatch
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              {match && (
                <>
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <Image
                      src={match.user.profile_photo || '/placeholder-avatar.png'}
                      alt={match.user.display_name}
                      fill
                      className="rounded-full object-cover border-4 border-primary"
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    You matched with {match.user.display_name}!
                  </h2>
                  <p className="text-muted">Say something nice to start the conversation</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const isMe = message.sender_id === currentUserId;

                return (
                  <div key={message.id}>
                    {shouldShowDate(index) && (
                      <div className="text-center my-6">
                        <span className="text-xs text-muted bg-surface px-3 py-1 rounded-full">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="flex items-end gap-2 max-w-[70%]">
                        {!isMe && match && (
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <Image
                              src={match.user.profile_photo || '/placeholder-avatar.png'}
                              alt={match.user.display_name}
                              fill
                              className="rounded-full object-cover"
                            />
                          </div>
                        )}
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isMe
                              ? 'bg-primary text-white rounded-br-sm'
                              : 'bg-surface text-white rounded-bl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              isMe ? 'text-white/70' : 'text-muted'
                            }`}
                          >
                            {formatTime(message.created_at)}
                            {isMe && message.read_at && ' ✓✓'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-surface">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto px-4 py-3 flex items-end gap-3"
        >
          <Textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none max-h-32"
            rows={1}
            disabled={isSending}
          />
          <Button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-6 py-3 disabled:opacity-50"
          >
            {isSending ? (
              <LoadingSpinner variant="inline" />
            ) : (
              'Send'
            )}
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={showUnmatchConfirm}
        title="Unmatch"
        message={`Are you sure you want to unmatch with ${match?.user.display_name ?? 'this person'}? This will delete your conversation and cannot be undone.`}
        confirmLabel="Unmatch"
        variant="danger"
        onConfirm={handleUnmatch}
        onCancel={() => setShowUnmatchConfirm(false)}
      />
    </div>
  );
}

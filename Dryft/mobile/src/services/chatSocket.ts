import { WS_BASE_URL } from '@/config';
import { getToken } from '@/store/authStore';

/**
 * Chat WebSocket client for realtime messaging, typing, and presence.
 * Manages connection lifecycle and event dispatch to subscribers.
 * @example
 * chatSocketService.connect();
 */
// Event Types
export type EventType =
  // Client -> Server
  | 'ping'
  | 'subscribe'
  | 'unsubscribe'
  | 'send_message'
  | 'typing_start'
  | 'typing_stop'
  | 'mark_read'
  // Server -> Client
  | 'pong'
  | 'error'
  | 'new_message'
  | 'message_sent'
  | 'typing'
  | 'presence'
  | 'new_match'
  | 'unmatched'
  | 'messages_read'
  // Call signaling (bidirectional)
  | 'call_request'
  | 'call_accept'
  | 'call_reject'
  | 'call_end'
  | 'call_busy'
  | 'call_offer'
  | 'call_answer'
  | 'call_candidate'
  | 'call_mute'
  | 'call_unmute'
  | 'call_video_off'
  | 'call_video_on';

// Envelope wraps all WebSocket messages
export interface Envelope<T = unknown> {
  type: EventType;
  payload?: T;
  ts: number;
}

// Payload Types
export interface NewMessagePayload {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: 'text' | 'image' | 'gif';
  content: string;
  created_at: number;
}

export interface MessageSentPayload {
  id: string;
  conversation_id: string;
  client_id?: string;
  created_at: number;
}

export interface TypingIndicatorPayload {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
}

export interface PresencePayload {
  user_id: string;
  is_online: boolean;
  last_seen?: number;
}

export interface NewMatchPayload {
  match_id: string;
  conversation_id: string;
  user: {
    id: string;
    display_name: string;
    photo_url?: string;
  };
  matched_at: number;
}

export interface UnmatchedPayload {
  match_id: string;
  conversation_id: string;
}

export interface MessagesReadPayload {
  conversation_id: string;
  reader_id: string;
  read_at: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// Event Handlers
export interface ChatSocketHandlers {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onNewMessage?: (payload: NewMessagePayload) => void;
  onMessageSent?: (payload: MessageSentPayload) => void;
  onTyping?: (payload: TypingIndicatorPayload) => void;
  onPresence?: (payload: PresencePayload) => void;
  onNewMatch?: (payload: NewMatchPayload) => void;
  onUnmatched?: (payload: UnmatchedPayload) => void;
  onMessagesRead?: (payload: MessagesReadPayload) => void;
  onError?: (payload: ErrorPayload) => void;
}

class ChatSocketService {
  private socket: WebSocket | null = null;
  private handlers: ChatSocketHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private subscribedConversations = new Set<string>();
  private pendingMessages = new Map<string, (payload: MessageSentPayload) => void>();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = getToken();
      if (!token) {
        reject(new Error('No auth token'));
        return;
      }

      try {
        this.socket = new WebSocket(WS_BASE_URL, [], {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        this.socket.onopen = () => {
          console.log('[ChatSocket] Connected');
          this.reconnectAttempts = 0;
          this.startPing();
          this.resubscribeConversations();
          this.handlers.onConnected?.();
          resolve();
        };

        this.socket.onclose = (event) => {
          console.log('[ChatSocket] Disconnected:', event.code, event.reason);
          this.stopPing();
          this.handlers.onDisconnected?.();
          this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
          console.error('[ChatSocket] Error:', error);
          reject(error);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    this.stopPing();
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    this.subscribedConversations.clear();
  }

  setHandlers(handlers: ChatSocketHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // Subscribe to a conversation for real-time updates
  subscribe(conversationId: string) {
    this.subscribedConversations.add(conversationId);
    this.send('subscribe', { conversation_id: conversationId });
  }

  // Unsubscribe from a conversation
  unsubscribe(conversationId: string) {
    this.subscribedConversations.delete(conversationId);
    this.send('unsubscribe', { conversation_id: conversationId });
  }

  // Send a message
  sendMessage(
    conversationId: string,
    content: string,
    type: 'text' | 'image' | 'gif' = 'text'
  ): Promise<MessageSentPayload> {
    return new Promise((resolve, reject) => {
      const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Store callback for when we get confirmation
      this.pendingMessages.set(clientId, resolve);

      // Set timeout for message confirmation
      setTimeout(() => {
        if (this.pendingMessages.has(clientId)) {
          this.pendingMessages.delete(clientId);
          reject(new Error('Message send timeout'));
        }
      }, 10000);

      this.send('send_message', {
        conversation_id: conversationId,
        type,
        content,
        client_id: clientId,
      });
    });
  }

  // Send typing indicator
  startTyping(conversationId: string) {
    this.send('typing_start', { conversation_id: conversationId });
  }

  stopTyping(conversationId: string) {
    this.send('typing_stop', { conversation_id: conversationId });
  }

  // Mark messages as read
  markRead(conversationId: string) {
    this.send('mark_read', { conversation_id: conversationId });
  }

  // Send call signaling message (used by callSignaling.ts)
  sendCallSignal(type: string, payload: unknown) {
    this.send(type as EventType, payload);
  }

  private send(type: EventType, payload?: unknown) {
    if (!this.isConnected()) {
      console.warn('[ChatSocket] Not connected, cannot send:', type);
      return;
    }

    const envelope: Envelope = {
      type,
      payload: payload as any,
      ts: Date.now(),
    };

    this.socket!.send(JSON.stringify(envelope));
  }

  private handleMessage(data: string) {
    try {
      const envelope: Envelope = JSON.parse(data);

      switch (envelope.type) {
        case 'pong':
          // Ping response received
          break;

        case 'new_message':
          this.handlers.onNewMessage?.(envelope.payload as NewMessagePayload);
          break;

        case 'message_sent': {
          const payload = envelope.payload as MessageSentPayload;
          // Resolve pending message promise
          if (payload.client_id && this.pendingMessages.has(payload.client_id)) {
            const resolve = this.pendingMessages.get(payload.client_id)!;
            this.pendingMessages.delete(payload.client_id);
            resolve(payload);
          }
          this.handlers.onMessageSent?.(payload);
          break;
        }

        case 'typing':
          this.handlers.onTyping?.(envelope.payload as TypingIndicatorPayload);
          break;

        case 'presence':
          this.handlers.onPresence?.(envelope.payload as PresencePayload);
          break;

        case 'new_match':
          this.handlers.onNewMatch?.(envelope.payload as NewMatchPayload);
          break;

        case 'unmatched':
          this.handlers.onUnmatched?.(envelope.payload as UnmatchedPayload);
          break;

        case 'messages_read':
          this.handlers.onMessagesRead?.(envelope.payload as MessagesReadPayload);
          break;

        case 'error':
          this.handlers.onError?.(envelope.payload as ErrorPayload);
          break;

        // Call signaling events - forward to callSignalingService
        case 'call_request':
        case 'call_accept':
        case 'call_reject':
        case 'call_end':
        case 'call_busy':
        case 'call_offer':
        case 'call_answer':
        case 'call_candidate':
        case 'call_mute':
        case 'call_unmute':
        case 'call_video_off':
        case 'call_video_on':
          // Lazy import to avoid circular dependency
          import('./callSignaling').then(({ callSignalingService }) => {
            callSignalingService.handleCallEvent(envelope.type, envelope.payload);
          });
          break;

        default:
          console.log('[ChatSocket] Unknown event:', envelope.type);
      }
    } catch (error) {
      console.error('[ChatSocket] Failed to parse message:', error);
    }
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send('ping');
    }, 30000); // Ping every 30 seconds
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private resubscribeConversations() {
    // Re-subscribe to all previously subscribed conversations after reconnect
    for (const conversationId of this.subscribedConversations) {
      this.send('subscribe', { conversation_id: conversationId });
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[ChatSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[ChatSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[ChatSocket] Reconnect failed:', error);
      });
    }, delay);
  }
}

export const chatSocketService = new ChatSocketService();
export default chatSocketService;

import apiClient from './client';
import {
  ApiResponse,
  ConversationsResponse,
  Message,
  MessagesResponse,
} from '../types';

export type MessageContentType = Message['type'];

export const chatApi = {
  /**
   * Get chat conversations.
   */
  async getConversations(): Promise<ApiResponse<ConversationsResponse>> {
    return apiClient.get<ConversationsResponse>('/v1/chat/conversations');
  },

  /**
   * Get messages for a match.
   */
  async getMessages(matchId: string): Promise<ApiResponse<MessagesResponse>> {
    return apiClient.get<MessagesResponse>(`/v1/chat/${matchId}/messages`);
  },

  /**
   * Send a message to a match.
   */
  async sendMessage(
    matchId: string,
    content: string,
    contentType: MessageContentType = 'text'
  ): Promise<ApiResponse<Message>> {
    return apiClient.post<Message>(`/v1/chat/${matchId}/messages`, {
      content,
      type: contentType,
    });
  },

  /**
   * Mark messages as read for a match.
   */
  async markAsRead(matchId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/v1/chat/${matchId}/read`);
  },
};

export default chatApi;

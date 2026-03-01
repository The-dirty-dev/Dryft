import apiClient from './client';
import { ApiResponse } from '../types';

export type NotificationType = 'new_match' | 'new_message' | 'new_like' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  created_at: number;
  read_at?: number;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface RegisterDeviceRequest {
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_id: string;
  app_version?: string;
  device_name?: string;
  os_version?: string;
}

export const notificationsApi = {
  /**
   * Register a device for push notifications.
   */
  async registerDevice(data: RegisterDeviceRequest): Promise<ApiResponse<{ device_id: string; status: string }>> {
    return apiClient.post<{ device_id: string; status: string }>('/v1/notifications/devices', data);
  },

  /**
   * Unregister a device.
   */
  async unregisterDevice(deviceId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/v1/notifications/devices/${deviceId}`);
  },

  /**
   * Fetch notifications for the current user.
   */
  async getNotifications(limit = 20, offset = 0): Promise<ApiResponse<NotificationsResponse>> {
    return apiClient.get<NotificationsResponse>(`/v1/notifications?limit=${limit}&offset=${offset}`);
  },

  /**
   * Mark a notification as read.
   */
  async markRead(notificationId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/v1/notifications/${notificationId}/read`);
  },

  /**
   * Mark all notifications as read.
   */
  async markAllRead(): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/v1/notifications/read-all');
  },

  /**
   * Get unread count.
   */
  async getUnreadCount(): Promise<ApiResponse<{ unread_count: number }>> {
    return apiClient.get<{ unread_count: number }>('/v1/notifications/unread-count');
  },
};

export default notificationsApi;

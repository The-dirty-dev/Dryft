'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useToast } from './Toast';
import notificationService, { NotificationData } from '@/lib/notifications';
import { API_ERROR_EVENT, type ApiErrorEventDetail } from '@/lib/api';

export function GlobalNotifications() {
  const router = useRouter();
  const { showMatchNotification, showToast } = useToast();

  // Initialize push notifications on mount
  useEffect(() => {
    const initPushNotifications = async () => {
      // Only initialize if user is authenticated
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) return;

      try {
        const parsed = JSON.parse(authStorage);
        if (!parsed.state?.token) return;

        // Initialize with foreground message handler
        await notificationService.initialize((payload) => {
          handleForegroundNotification(payload.data);
        });
      } catch (error) {
        console.error('[GlobalNotifications] Push init error:', error);
      }
    };

    initPushNotifications();

    // Listen for service worker messages (notification clicks)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'notification_click') {
        const { targetUrl } = event.data;
        if (targetUrl) {
          router.push(targetUrl);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [router]);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail;
      if (!detail) return;

      showToast({
        type: 'error',
        title: 'Something went wrong',
        message: detail.message,
      });
    };

    window.addEventListener(API_ERROR_EVENT, handleApiError as EventListener);
    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleApiError as EventListener);
    };
  }, [showToast]);

  // Handle foreground push notifications
  const handleForegroundNotification = (data?: NotificationData) => {
    if (!data) return;

    switch (data.type) {
      case 'new_match':
        if (data.match_id) {
          showMatchNotification(
            data.caller_name || 'Someone',
            undefined,
            () => router.push(`/messages/${data.match_id}`)
          );
        }
        break;

      case 'new_message':
        showToast({
          type: 'info',
          message: 'New message received',
          action: data.match_id
            ? { label: 'View', onClick: () => router.push(`/messages/${data.match_id}`) }
            : undefined,
        });
        break;

      case 'incoming_call':
        showToast({
          type: 'info',
          message: `${data.caller_name || 'Someone'} is calling...`,
          duration: 30000,
          action: data.call_id
            ? { label: 'Answer', onClick: () => router.push(`/call/${data.call_id}?answer=true`) }
            : undefined,
        });
        break;

      case 'new_like':
        showToast({
          type: 'success',
          message: 'Someone likes you!',
          action: { label: 'See who', onClick: () => router.push('/discover') },
        });
        break;
    }
  };

  // Handle WebSocket events for real-time updates
  useChatSocket({
    onNewMatch: (payload) => {
      showMatchNotification(
        payload.user.display_name,
        payload.user.photo_url,
        () => router.push(`/messages/${payload.match_id}`)
      );
    },
  });

  return null;
}

export default GlobalNotifications;

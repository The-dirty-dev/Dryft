import { useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationData } from '../services/notifications';
import { RootStackParamList } from '../navigation';
import { useAuthStore } from '../store/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * React hook `useNotifications`.
 * @returns Hook state and actions.
 * @example
 * const value = useNotifications();
 */
export function useNotifications() {
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated } = useAuthStore();
  const initialized = useRef(false);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData;

      if (data) {
        notificationService.handleNotificationNavigation(data, (screen, params) => {
          navigation.navigate(screen as keyof RootStackParamList, params as any);
        });
      }
    },
    [navigation]
  );

  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      const data = notification.request.content.data as NotificationData;
      console.log('[useNotifications] Notification received:', notification.request.content);

      // Handle VR haptic notifications - trigger device vibration
      if (data?.type === 'vr_haptic_ping' && data.haptic_intensity) {
        notificationService.handleHapticNotification(data.haptic_intensity as number);
      }

      // Handle VR session notifications - could show in-app alert
      if (data?.type === 'vr_session_started' || data?.type === 'vr_invite') {
        // Could trigger an in-app banner or alert here
        console.log('[useNotifications] VR session notification:', data.session_code);
      }
    },
    []
  );

  useEffect(() => {
    if (isAuthenticated && !initialized.current) {
      initialized.current = true;
      notificationService.initialize(handleNotificationReceived, handleNotificationResponse);
    }

    return () => {
      // Cleanup is handled by the service
    };
  }, [isAuthenticated, handleNotificationReceived, handleNotificationResponse]);

  // Handle notification that was received when app was killed
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });
  }, [handleNotificationResponse]);

  return {
    clearNotifications: () => notificationService.clearAll(),
    getBadgeCount: () => notificationService.getBadgeCount(),
    setBadgeCount: (count: number) => notificationService.setBadgeCount(count),
  };
}

export default useNotifications;

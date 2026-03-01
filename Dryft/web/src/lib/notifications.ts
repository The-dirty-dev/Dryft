'use client';

import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp, FirebaseApp } from 'firebase/app';

// Firebase configuration - loaded from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export interface NotificationData {
  type: 'new_match' | 'new_message' | 'new_like' | 'incoming_call' | 'system';
  match_id?: string;
  call_id?: string;
  caller_name?: string;
  [key: string]: string | undefined;
}

class NotificationService {
  private static instance: NotificationService;
  private app: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private token: string | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize Firebase and request notification permission
   */
  async initialize(
    onNotificationReceived?: (payload: { title: string; body: string; data?: NotificationData }) => void
  ): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    // Check if Firebase config is provided
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.log('[Notifications] Firebase not configured');
      return null;
    }

    try {
      // Initialize Firebase app
      if (!this.app) {
        this.app = initializeApp(firebaseConfig);
      }

      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        console.log('[Notifications] Service workers not supported');
        return null;
      }

      // Register the service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[Notifications] Service worker registered');

      // Send Firebase config to service worker
      if (registration.active) {
        registration.active.postMessage({
          type: 'FIREBASE_CONFIG',
          config: firebaseConfig,
        });
      }

      // Also send when service worker becomes active
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active) {
          reg.active.postMessage({
            type: 'FIREBASE_CONFIG',
            config: firebaseConfig,
          });
        }
      });

      // Get messaging instance
      this.messaging = getMessaging(this.app);

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[Notifications] Permission denied');
        return null;
      }

      // Get the FCM token
      this.token = await getToken(this.messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      console.log('[Notifications] Token obtained');

      // Register token with backend
      if (this.token) {
        await this.registerTokenWithBackend(this.token);
      }

      // Handle foreground messages
      if (onNotificationReceived) {
        onMessage(this.messaging, (payload) => {
          console.log('[Notifications] Foreground message:', payload);
          onNotificationReceived({
            title: payload.notification?.title || 'Dryft',
            body: payload.notification?.body || '',
            data: payload.data as NotificationData,
          });
        });
      }

      this.initialized = true;
      return this.token;
    } catch (error) {
      console.error('[Notifications] Initialization error:', error);
      return null;
    }
  }

  /**
   * Register the push token with the backend
   */
  async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const authToken = this.getAuthToken();
      if (!authToken) {
        console.log('[Notifications] No auth token, skipping registration');
        return;
      }

      const deviceId = this.getDeviceId();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/v1/notifications/devices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            token,
            platform: 'web',
            device_id: deviceId,
            app_version: '1.0.0',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to register token: ${response.status}`);
      }

      console.log('[Notifications] Token registered with backend');
    } catch (error) {
      console.error('[Notifications] Failed to register token:', error);
    }
  }

  /**
   * Unregister from push notifications (on logout)
   */
  async unregister(): Promise<void> {
    try {
      const authToken = this.getAuthToken();
      const deviceId = this.getDeviceId();

      if (authToken && deviceId) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/v1/notifications/devices/${deviceId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        console.log('[Notifications] Token unregistered');
      }
    } catch (error) {
      console.error('[Notifications] Failed to unregister:', error);
    }

    this.token = null;
    this.initialized = false;
  }

  /**
   * Get the current push token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if notifications are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if notifications are supported and enabled
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get notification permission status
   */
  getPermissionStatus(): NotificationPermission | null {
    if (typeof window === 'undefined') return null;
    return Notification.permission;
  }

  /**
   * Generate or retrieve a unique device ID
   */
  private getDeviceId(): string {
    const key = 'dryft_device_id';
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
      deviceId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  }

  /**
   * Get auth token from localStorage
   */
  private getAuthToken(): string | null {
    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state?.token || null;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService;

// Firebase messaging service worker for background notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

let messaging = null;

self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(clients.claim());
});

// Receive config from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    initializeFirebase(event.data.config);
  }
});

function initializeFirebase(config) {
  if (messaging) return; // Already initialized

  try {
    firebase.initializeApp(config);
    messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] Background message:', payload);

      const notificationData = payload.data || {};
      const notificationTitle = payload.notification?.title || 'Drift';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: notificationData.type || 'default',
        data: notificationData,
        requireInteraction: notificationData.type === 'incoming_call',
        actions: getActionsForType(notificationData.type),
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });

    console.log('[SW] Firebase initialized');
  } catch (error) {
    console.error('[SW] Firebase init error:', error);
  }
}

// Get notification actions based on type
function getActionsForType(type) {
  switch (type) {
    case 'incoming_call':
      return [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ];
    case 'new_message':
      return [
        { action: 'reply', title: 'Reply' },
        { action: 'view', title: 'View' },
      ];
    case 'new_match':
      return [
        { action: 'view', title: 'View Profile' },
        { action: 'message', title: 'Say Hi' },
      ];
    default:
      return [];
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Determine the target URL based on notification type and action
  switch (data.type) {
    case 'new_match':
      if (event.action === 'message') {
        targetUrl = `/messages/${data.match_id}`;
      } else {
        targetUrl = '/matches';
      }
      break;

    case 'new_message':
      targetUrl = data.match_id ? `/messages/${data.match_id}` : '/messages';
      break;

    case 'incoming_call':
      if (event.action === 'answer') {
        targetUrl = `/call/${data.call_id}?answer=true`;
      } else if (event.action === 'decline') {
        // Just close, or could send decline signal
        return;
      } else {
        targetUrl = `/call/${data.call_id}`;
      }
      break;

    case 'new_like':
      targetUrl = '/discover';
      break;

    default:
      targetUrl = '/';
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'notification_click',
            data: data,
            targetUrl: targetUrl,
          });
          return client.focus();
        }
      }
      // No window open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Handle push events directly (fallback if Firebase messaging doesn't catch it)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log('[SW] Push event:', payload);

    // If Firebase messaging is handling it, skip
    if (messaging) return;

    const notificationData = payload.data || {};
    const notificationTitle = payload.notification?.title || 'Drift';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: notificationData.type || 'default',
      data: notificationData,
    };

    event.waitUntil(self.registration.showNotification(notificationTitle, notificationOptions));
  } catch (error) {
    console.error('[SW] Push event error:', error);
  }
});

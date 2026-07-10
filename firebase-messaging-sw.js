// firebase-messaging-sw.js
// This runs even when the app is fully closed and the screen is off.
// It's what lets the server-side push actually wake up a notification on Android.

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyApHsd0T4C4TtwNQEexHr22BRd-2Vdlim4",
  authDomain: "pwa-reminder-d9ef4.firebaseapp.com",
  projectId: "pwa-reminder-d9ef4",
  storageBucket: "pwa-reminder-d9ef4.firebasestorage.app",
  messagingSenderId: "834539694216",
  appId: "1:834539694216:web:8d5485a5926be891e3573d"
});

const messaging = firebase.messaging();

// Fires when the server sends a push and the app is NOT in the foreground
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = '⏰ Reminder';
  const options = {
    body: data.text || 'You have a reminder',
    icon: './icon.svg',
    badge: './icon.svg',
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true, // stays on screen until dismissed
    tag: data.id || 'reminder',
    data: data,
    actions: [
      { action: 'snooze5', title: 'Snooze 5 min' },
      { action: 'snooze15', title: 'Snooze 15 min' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  self.registration.showNotification(title, options);
});

// Handle notification button taps
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({ action: action || 'dismiss', data });
        return client.focus();
      }
      // No open window — just open the app
      return clients.openWindow('./');
    })
  );
});

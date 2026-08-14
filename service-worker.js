// One worker handles offline caching AND Firebase background messages.
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyApHsd0T4C4TtwNQEexHr22BRd-2Vdlim4',
  authDomain: 'pwa-reminder-d9ef4.firebaseapp.com',
  projectId: 'pwa-reminder-d9ef4',
  storageBucket: 'pwa-reminder-d9ef4.firebasestorage.app',
  messagingSenderId: '834539694216',
  appId: '1:834539694216:web:8d5485a5926be891e3573d'
});

const messaging = firebase.messaging();
const CACHE_NAME = 'quick-reminder-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  return self.registration.showNotification(payload.notification?.title || '⏰ Reminder', {
    body: payload.notification?.body || data.text || 'Your reminder is due',
    icon: './icon.svg',
    badge: './icon.svg',
    vibrate: [300, 100, 300, 100, 500],
    requireInteraction: true,
    tag: data.id || 'quick-reminder',
    data,
    actions: [
      { action: 'snooze5', title: 'Snooze 5 min' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type !== 'FIRE_REMINDER') return;
  event.waitUntil(self.registration.showNotification('⏰ Reminder', {
    body: msg.text,
    icon: './icon.svg',
    badge: './icon.svg',
    vibrate: [300, 100, 300],
    requireInteraction: true,
    tag: msg.id,
    data: msg
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length) {
      list[0].postMessage({ action: event.action || 'dismiss', data });
      return list[0].focus();
    }
    return clients.openWindow('./');
  }));
});

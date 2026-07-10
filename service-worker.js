// service-worker.js
const CACHE_NAME = 'quick-reminder-v1';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// In-memory copy of active reminders, synced from the page whenever it's open
let REMINDERS = [];

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'SYNC_REMINDERS') {
    REMINDERS = msg.reminders || [];
  }

  if (msg.type === 'FIRE_REMINDER') {
    self.registration.showNotification('⏰ Reminder', {
      body: msg.text,
      icon: './icon.svg',
      badge: './icon.svg',
      vibrate: [300, 100, 300],
      requireInteraction: true,
      tag: msg.id,
      data: { id: msg.id, text: msg.text, date: msg.date, time: msg.time },
      actions: [
        { action: 'snooze5', title: 'Snooze 5 min' },
        { action: 'snooze15', title: 'Snooze 15 min' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  }
});

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
      return clients.openWindow('./');
    })
  );
});

// Periodic Background Sync fallback (best-effort only — the real reliability
// comes from the server-side push, not this).
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkLocalReminders());
  }
});

async function checkLocalReminders() {
  const now = new Date();
  const curDate = now.toISOString().slice(0, 10);
  const curTime = now.toTimeString().slice(0, 5);

  for (const r of REMINDERS) {
    if (r.date === curDate && r.time === curTime) {
      self.registration.showNotification('⏰ Reminder', {
        body: r.text,
        icon: './icon.svg',
        requireInteraction: true,
        tag: r.id
      });
    }
  }
}

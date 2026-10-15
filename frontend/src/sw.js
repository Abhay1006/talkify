/* eslint-env serviceworker */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Talkify's service worker: makes the app installable and quick to open
// (the built shell is precached), and shows push notifications.
//
// Deliberately NOT cached: anything under /api or /socket.io. Messages and
// media are private and live; serving them from a cache could show one
// account's data after another logs in on the same device.

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Single-page app: every navigation gets the cached shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/socket\.io/],
  })
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'Talkify', body: event.data?.text() };
  }

  event.waitUntil(
    (async () => {
      // If Talkify is open and focused the user already sees it; don't
      // double up with a system notification.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((w) => w.focused && w.visibilityState === 'visible')) return;

      await self.registration.showNotification(data.title || 'Talkify', {
        body: data.body || '',
        tag: data.tag,
        renotify: Boolean(data.tag),
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: data.url || '/' },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only ever open our own origin, whatever the payload said.
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) target.href = self.location.origin;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'OPEN_URL', url: target.pathname + target.search });
        return;
      }
      await self.clients.openWindow(target.href);
    })()
  );
});

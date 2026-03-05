const CACHE_NAME = 'gharbelmatar-v3';

self.addEventListener('install', (event) => {
  console.log('✅ SW installing...');
  self.skipWaiting();
});

self.addEventListener('push', (event) => {
  console.log('🔔 Push received');

  let data = { title: 'إشعار جديد', body: 'لديك تحديث جديد', url: '/' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('✅ Notification shown'))
      .catch(err => console.error('❌ Show failed:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Clicked:', event.action);
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

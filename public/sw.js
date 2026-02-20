const CACHE_NAME = 'gharbelmatar-v2';

self.addEventListener('install', (event) => {
  console.log('✅ SW installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ SW activated');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
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

  // ✅ فتح الـ URL الصح من الـ data
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // لو التطبيق مفتوح بالفعل، focus عليه وروح للـ URL
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // لو مش مفتوح، افتحه
      return clients.openWindow(targetUrl);
    })
  );
});

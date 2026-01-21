// public/sw.js
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('🔔 SW: Push Received', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
      console.log('📦 Push Data:', data);
    } catch (e) {
      console.warn('⚠️ Push data is not JSON, using text');
      data = { title: 'تنبيه', body: event.data.text() };
    }
  }

  const title = data.title || 'إشعار جديد';
  const options = {
    body: data.body || 'لديك تنبيه جديد من النظام',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'renotify', // استخدام تاج ثابت للتجربة
    renotify: true,
    requireInteraction: true, // يمنع اختفاء التنبيه تلقائياً
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('✅ Notification Shown'))
      .catch((err) => console.error('❌ Notification Error:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification Clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

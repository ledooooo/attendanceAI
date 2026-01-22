// public/sw.js
self.addEventListener('install', (event) => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  console.log('🔔 Push event received inside SW');

  let title = 'اختبار';
  let body = 'هل ظهر هذا التنبيه؟';

  if (event.data) {
    try {
      const json = event.data.json();
      title = json.title || title;
      body = json.body || body;
    } catch (e) {
      body = event.data.text();
    }
  }

  // خيارات بسيطة جداً بدون صور لتجنب أخطاء التحميل
  const options = {
    body: body,
    requireInteraction: true, // يظل ظاهراً حتى تغلقه
    dir: 'rtl'
    // تم إزالة icon و badge مؤقتاً للتأكد
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('✅ Notification displayed'))
      .catch(err => console.error('❌ Display failed:', err))
  );
});

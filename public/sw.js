// public/sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  // 1. محاولة قراءة البيانات بأمان
  let data = { title: 'تنبيه جديد', body: 'لديك رسالة جديدة', url: '/' };
  
  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (e) {
      data.body = event.data.text(); // لو وصلت كنص عادي
    }
  }

  // 2. خيارات الإشعار (مهمة جداً للأندرويد)
  const options = {
    body: data.body,
    icon: '/pwa-192x192.png', // تأكد أن هذه الصورة موجودة
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'test-notification', // يمنع التكرار
    renotify: true, // يهتز حتى لو التنبيه موجود
    requireInteraction: true, // يظل معلقاً حتى يراه المستخدم
    data: {
      url: data.url
    }
  };

  // 3. الأمر الفعلي للعرض
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

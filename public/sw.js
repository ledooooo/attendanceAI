// public/sw.js

// 1. التثبيت والتفعيل الفوري (تخطي الانتظار)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // يجبر المتصفح على استبدال الـ Worker القديم فوراً
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // يسيطر على كل الصفحات المفتوحة فوراً
});

// 2. استقبال الإشعار (يعمل حتى والتطبيق مغلق)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // في حالة وصول نص عادي
    data = { title: 'تنبيه إداري', body: event.data.text(), url: '/' };
  }

  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: '/pwa-192x192.png', // تأكد أن الصورة موجودة في public
    badge: '/pwa-192x192.png', // الأيقونة الصغيرة في شريط الحالة
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200], // اهتزاز
    tag: 'attendance-notification', // يمنع تكرار الإشعارات فوق بعضها
    renotify: true, // يهتز كل مرة حتى لو الإشعار قديم موجود
    requireInteraction: true, // ⚠️ هام: يمنع الإشعار من الاختفاء تلقائياً
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: 'عرض' },
      { action: 'close', title: 'إغلاق' }
    ]
  };

  // ⚠️ استخدام waitUntil ضروري جداً لضمان بقاء العملية حية
  event.waitUntil(
    self.registration.showNotification(data.title || 'المركز الطبي', options)
  );
});

// 3. التفاعل مع الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // إغلاق الإشعار أولاً

  if (event.action === 'close') return;

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // أ) إذا كان التطبيق مفتوحاً بالفعل، ركز عليه وانتقل للرابط
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === urlToOpen && 'focus' in client) {
        return client.focus();
      }
    }
    // ب) إذا لم يكن مفتوحاً، افتح نافذة جديدة
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});

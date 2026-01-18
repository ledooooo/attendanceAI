self.addEventListener('install', (event) => {
  self.skipWaiting(); // تفعيل التحديث فوراً
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // السيطرة على المتصفح فوراً
});

self.addEventListener('push', function(event) {
  if (event.data) {
    // محاولة قراءة البيانات بأكثر من طريقة لضمان النجاح
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'تنبيه جديد', body: event.data.text() };
    }

    const options = {
      body: data.body || 'يوجد تحديث جديد في النظام',
      icon: '/pwa-192x192.png', // تأكد من وجود هذه الصورة
      badge: '/pwa-192x192.png', // أيقونة صغيرة تظهر في الشريط العلوي (يفضل أن تكون أبيض وأسود)
      vibrate: [200, 100, 200], // نمط اهتزاز قوي
      requireInteraction: true, // ⚠️ مهم جداً: يمنع الإشعار من الاختفاء تلقائياً
      data: {
        url: data.url || '/'
      },
      actions: [
        { action: 'open', title: 'عرض التفاصيل' }
      ]
    };

    // ⚠️ استخدام event.waitUntil ضروري جداً لإبقاء الـ Service Worker حياً
    event.waitUntil(
      self.registration.showNotification(data.title || 'إشعار من المركز الطبي', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // كود فتح الرابط عند الضغط
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 1. إذا كان الموقع مفتوحاً بالفعل، قم بالتركيز عليه
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus().then(c => c.navigate(event.notification.data.url));
        }
      }
      // 2. إذا كان مغلقاً، افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

// 1. إجبار المتصفح على تفعيل النسخة الجديدة فوراً (Skip Waiting)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // يتخطى مرحلة الانتظار ويفعل الكود فوراً
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // السيطرة على المتصفح فوراً دون الحاجة لإعادة فتحه
});

// 2. استقبال الإشعار
self.addEventListener('push', function(event) {
  if (event.data) {
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'تنبيه إداري', body: event.data.text() };
    }

    const options = {
      body: data.body || 'لديك تنبيه جديد',
      icon: '/pwa-192x192.png', // تأكد أن الاسم يطابق الصورة في public
      badge: '/pwa-192x192.png', // الأيقونة الصغيرة
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200], // نمط اهتزاز أقوى
      
      // ⚠️ أهم الإعدادات للخلفية:
      tag: 'attendance-notification', // يمنع تراكم الإشعارات
      renotify: true, // يهتز الهاتف حتى لو كان هناك إشعار سابق لم يقرأ
      requireInteraction: true, // يمنع الإشعار من الاختفاء تلقائياً (يجبر المستخدم على التفاعل)
      
      data: {
        url: data.url || '/'
      },
      actions: [
        { action: 'open', title: 'عرض' },
        { action: 'close', title: 'إغلاق' }
      ]
    };

    // استخدام event.waitUntil ضروري جداً لإبقاء الـ Worker حياً حتى يظهر الإشعار
    event.waitUntil(
      self.registration.showNotification(data.title || 'المركز الطبي', options)
    );
  }
});

// 3. التفاعل مع الإشعار
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // إذا كان الموقع مفتوحاً، قم بالتركيز عليه
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus().then(c => c.navigate(event.notification.data.url));
        }
      }
      // إذا كان مغلقاً، افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

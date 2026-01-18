// 1. إجبار المتصفح على استبدال الـ Service Worker القديم فوراً
self.addEventListener('install', (event) => {
  self.skipWaiting(); // تفعيل التحديث فوراً دون انتظار إغلاق التبويبات
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // السيطرة على المتصفح فوراً
});

// 2. استقبال الإشعار
self.addEventListener('push', function(event) {
  if (event.data) {
    let data;
    try {
      // محاولة قراءة البيانات كـ JSON
      data = event.data.json();
    } catch (e) {
      // لو وصلت كنص عادي
      data = { title: 'تنبيه إداري', body: event.data.text() };
    }

    const options = {
      body: data.body || 'إشعار جديد من النظام',
      icon: '/pwa-192x192.png', // تأكد أن الصورة موجودة
      badge: '/pwa-192x192.png',
      dir: 'rtl', // اتجاه النص للعربية
      lang: 'ar',
      vibrate: [200, 100, 200], // هزاز للموبايل
      tag: 'attendance-notification', // يمنع تراكم الإشعارات فوق بعضها
      renotify: true, // إصدار صوت وهزاز حتى لو في إشعارات قديمة
      requireInteraction: true, // ⚠️ الأهم: يمنع اختفاء الإشعار تلقائياً
      data: {
        url: data.url || '/'
      },
      actions: [
        { action: 'open', title: 'عرض' }
      ]
    };

    // ⚠️ استخدام event.waitUntil ضروري جداً لإبقاء العملية حية
    event.waitUntil(
      self.registration.showNotification(data.title || 'المركز الطبي', options)
    );
  }
});

// 3. عند الضغط على الإشعار
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  // فتح الرابط أو التركيز على التبويب المفتوح
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // لو الموقع مفتوح أصلاً، ركز عليه
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus().then(c => c.navigate(event.notification.data.url));
        }
      }
      // لو مغلق، افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

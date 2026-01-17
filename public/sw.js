// الاستماع لحدث وصول إشعار من السيرفر (Push Event)
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json(); // نفترض أن السيرفر يرسل بيانات JSON
    
    const options = {
      body: data.body || 'لديك تنبيه جديد من المركز الطبي',
      icon: data.icon || '/logo.png', // تأكد من وجود شعار في مجلد public
      badge: '/badge.png', // أيقونة صغيرة تظهر في شريط التنبيهات
      vibrate: [100, 50, 100], // نمط الهزاز
      data: {
        url: data.url || '/' // الرابط الذي سيفتح عند الضغط على الإشعار
      },
      actions: [
        { action: 'open', title: 'عرض التفاصيل' },
        { action: 'close', title: 'إغلاق' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'تنبيه جديد', options)
    );
  }
});

// الاستماع لحدث الضغط على الإشعار
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // إغلاق الإشعار

  if (event.action === 'close') return;

  // فتح الرابط المحدد في الإشعار
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        return client.focus().then(c => c.navigate(event.notification.data.url));
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});

import { supabase } from '../supabaseClient';

// ⚠️ هام: ضع المفتاح العام هنا (بدون مسافات زائدة)
const VAPID_PUBLIC_KEY = 'BJ5Rx-llNAH1bWDuB6miFY2GLp6qQz3XSRWsD9_onnn430E7HZmN5w3VSR17DV9qxl341wsJjc-35lOqNTBo65k'; // هذا المفتاح من ملفك السابق

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(userId: string) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.error('❌ المتصفح لا يدعم الإشعارات');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // تسجيل الـ SW إذا لم يكن مسجلاً (احتياطياً)
    let registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
    }

    // الاشتراك
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
    }

    // حفظ في قاعدة البيانات
    const subscriptionData = JSON.parse(JSON.stringify(subscription));
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription_data: subscriptionData,
        device_info: {
             userAgent: navigator.userAgent,
             platform: navigator.platform
        },
        updated_at: new Date().toISOString()
      }, {
        // نستخدم user_id وهذا العمود الفريد
        onConflict: 'user_id, subscription_data' // تأكد من إنشاء الـ constraint في الخطوة 2
      });

    if (error) console.error('❌ خطأ Supabase:', error);
    else console.log('✅ تم تفعيل الإشعارات وحفظها');
    
    return true;

  } catch (error) {
    console.error('❌ خطأ في الإشعارات:', error);
    return false;
  }
}

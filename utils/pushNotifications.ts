import { supabase } from '../supabaseClient';

// ⚠️ مفتاحك العام (تأكد أنه صحيح)
const VAPID_PUBLIC_KEY = 'BM0IXAut6bPbAvWuDvT7hlT9Twhl1j_BtSBo6UEUplxqXAnJ3XtkD30SvDe0w-B-KjmVqwOknpfqhTIVMwQmurk';

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
  console.log("🚀 بدء عملية تسجيل الإشعارات للمستخدم:", userId);
  
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.error('❌ المتصفح لا يدعم الإشعارات');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ المستخدم رفض الإذن');
      return false;
    }

    // تجهيز Service Worker
    let registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
    }

    // الحصول على الاشتراك
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
    }

    // 🛠️ التجهيز للإرسال لقاعدة البيانات
    const subscriptionData = JSON.parse(JSON.stringify(subscription));
    const endpoint = subscriptionData.endpoint; // استخراج الرابط للمقارنة

    console.log("📡 جاري حفظ الاشتراك في Supabase...");

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription_data: subscriptionData,
        endpoint: endpoint, // ✅ نرسل الرابط صراحةً ليطابق القيد في الجدول
        device_info: {
             userAgent: navigator.userAgent,
             platform: navigator.platform
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, endpoint' // ✅ الآن يطابق CONSTRAINT unique_user_device
      });

    if (error) {
        console.error('❌ فشل الحفظ في قاعدة البيانات:', error.message, error.details);
    } else {
        console.log('✅ تم حفظ الاشتراك بنجاح في الجدول!');
    }
    
    return true;

  } catch (error) {
    console.error('❌ خطأ غير متوقع:', error);
    return false;
  }
}

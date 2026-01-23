import { supabase } from '../supabaseClient';

// يفضل وضع المفتاح في ملف .env باسم VITE_VAPID_PUBLIC_KEY
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
  
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.error('❌ المتصفح لا يدعم الإشعارات');
    return false;
  }

  try {
    // 1. طلب الإذن من المستخدم
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ المستخدم رفض إذن الإشعارات');
      return false;
    }

    // 2. تسجيل Service Worker (أو التأكد من وجوده)
    // نستخدم register مباشرة لضمان وجوده، ثم ننتظر ready
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // 3. الاشتراك في خدمة الدفع (Push Service)
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // 4. تجهيز البيانات للإرسال
    // تحويل الاشتراك إلى كائن JSON عادي ليتم تخزينه في قاعدة البيانات
    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    console.log("📡 جاري حفظ الاشتراك في Supabase...");

    // 5. الحفظ في Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription_data: subscriptionJson, // JSONb column
        endpoint: endpoint, // Text column (Primary Key part or Unique)
        device_info: {
             userAgent: navigator.userAgent,
             platform: navigator.platform,
             language: navigator.language
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, endpoint' // ✅ يجب أن يكون هناك Unique Index في الجدول على هذين الحقلين
      });

    if (error) {
      console.error('❌ فشل الحفظ في قاعدة البيانات:', error.message);
      return false;
    } 
    
    console.log('✅ تم تفعيل الإشعارات وحفظ الاشتراك بنجاح!');
    return true;

  } catch (error) {
    console.error('❌ خطأ غير متوقع أثناء تفعيل الإشعارات:', error);
    return false;
  }
}

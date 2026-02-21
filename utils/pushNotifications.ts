import { supabase } from '../supabaseClient';

// ✅ تأكد من عدم وجود أي مسافات قبل أو بعد المفتاح
const VAPID_PUBLIC_KEY = 'BFg7hJozSKJ3nU4lmiKfWPwCMWW3bHHBmK-gcGheDNCXbsjjf4w9hpVhXRI_hUaGzGSx4shYYQJ8mvlbieVmGzc';

// ✅ دالة التحويل المحسنة (أكثر أماناً)
function urlBase64ToUint8Array(base64String: string) {
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (error) {
    console.error("❌ خطأ في تحويل الـ Public Key:", error);
    throw new Error("Invalid VAPID Key");
  }
}

export async function requestNotificationPermission(userId: string | number) {
  const validUserId = String(userId);
  console.log("🚀 جاري محاولة تسجيل إشعارات للمستخدم:", validUserId);

  if (!validUserId) {
    console.error('❌ userId غير صالح');
    return false;
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.error('❌ المتصفح لا يدعم الإشعارات أو الـ Service Worker غير مسجل');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ المستخدم رفض إذن الإشعارات');
      return false;
    }

    // الانتظار حتى يصبح الـ Service Worker جاهزاً
    const registration = await navigator.serviceWorker.ready;
    console.log("✅ Service Worker جاهز، جاري الاشتراك...");

    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log("⏳ لا يوجد اشتراك مسبق، جاري إنشاء اشتراك جديد...");
      
      // ✅ تحويل المفتاح هنا
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    } else {
      console.log("✅ اشتراك موجود بالفعل");
    }

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    // حذف القديم (لتجنب الأخطاء)
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

    // إضافة الجديد
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: validUserId, 
        subscription_data: subscriptionJson,
        endpoint: endpoint,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        },
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ فشل حفظ الاشتراك في قاعدة البيانات:', error.message);
      return false;
    }

    console.log('🎉 تم التسجيل وحفظ الاشتراك بنجاح!');
    return true;

  } catch (error) {
    console.error('❌ خطأ غير متوقع أثناء التسجيل (AbortError عادة يعني مشكلة في المفتاح):', error);
    return false;
  }
}

export const sendSystemNotification = async (
  userId: string | number, 
  title: string,
  message: string,
  type: 'task' | 'task_update' | 'general' | 'competition' = 'general'
) => {
  const validUserId = String(userId);
  try {
    const { error: dbError } = await supabase.from('notifications').insert({
      user_id: validUserId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    });

    if (dbError) console.error('Database Notification Error:', dbError);

    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: validUserId, 
          title: title,
          body: message,
          url: type.includes('task') ? '/staff?tab=tasks' : '/admin?tab=tasks'
        }
      });

      if (error) {
        console.error('Push invoke error:', error);
      } else {
        console.log('✅ Push sent:', data);
      }
    } catch (pushError) {
      console.warn('Push failed:', pushError);
    }

  } catch (error) {
    console.error('Notification System Error:', error);
  }
};

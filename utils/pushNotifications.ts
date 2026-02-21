import { supabase } from '../supabaseClient';

// المفتاح العام كما هو، تأكد من عدم وجود مسافات حوله
const VAPID_PUBLIC_KEY = 'BFg7hJozSKJ3nU4lmiKfWPwCMWW3bHHBmK-gcGheDNCXbsjjf4w9hpVhXRI_hUaGzGSx4shYYQJ8mvlbieVmGzc';

// دالة التحويل القياسية الآمنة
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(userId: string | number) {
  const validUserId = String(userId);
  console.log("🚀 جاري محاولة تسجيل إشعارات للمستخدم:", validUserId);

  if (!validUserId) {
    console.error('❌ userId غير صالح');
    return false;
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.error('❌ المتصفح لا يدعم الإشعارات');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ المستخدم رفض إذن الإشعارات');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // 🛑 [الحل الجذري لخطأ AbortError]:
    // جلب أي اشتراك قديم عالق في المتصفح وحذفه برمجياً لتهيئة بيئة نظيفة
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
        console.log("🔄 تم العثور على اشتراك قديم في المتصفح... جاري حذفه (Unsubscribe)");
        await existingSubscription.unsubscribe();
    }

    console.log("⏳ جاري إنشاء اشتراك جديد بالمفتاح العام...");
    
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    
    // المفتاح السليم يجب أن يكون طوله 65 بايت، هذا الفحص للتأكيد
    if (applicationServerKey.length !== 65) {
        console.warn(`⚠️ طول المفتاح المحول هو ${applicationServerKey.length}، قد يسبب هذا مشكلة إذا لم يكن 65`);
    }

    // إنشاء الاشتراك الجديد
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    console.log("📡 تم إنشاء الاشتراك بالمتصفح، جاري الحفظ في قاعدة البيانات...");

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
    console.error('❌ فشل التسجيل بشكل غير متوقع:', error);
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

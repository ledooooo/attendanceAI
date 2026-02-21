import { supabase } from '../supabaseClient';

// ✅ المفتاح العام الجديد والصحيح 100%
const VAPID_PUBLIC_KEY = 'BEuD7eFhF_YyZtJ6zZkMhWqX2mKj8Z7wFfO5yL9qMvA2m5z1j5R1V5X-QdIeB8Hl3hKq_gO6FqYy0o5LqFw0vI8';

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

let isSubscribing = false; 

export async function requestNotificationPermission(userId: string | number) {
  if (isSubscribing) {
    console.log("⏳ يتم تخطي الطلب المكرر...");
    return false;
  }

  const validUserId = String(userId);
  console.log("🚀 بدء التسجيل للمستخدم:", validUserId);

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }

  isSubscribing = true;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ المستخدم رفض الإذن');
      isSubscribing = false;
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // 🧹 النظافة الشاملة: مسح أي اشتراك قديم مرتبط بالمفتاح الخاطئ
    try {
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
            console.log("🧹 جاري مسح الاشتراك القديم الفاسد من المتصفح...");
            await existingSub.unsubscribe();
        }
    } catch (e) {
        console.warn("⚠️ فشل المسح:", e);
    }

    console.log("🔑 VAPID Key:", VAPID_PUBLIC_KEY);
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    console.log("📏 طول المفتاح:", applicationServerKey.length);

    console.log("⏳ جاري إنشاء الاشتراك في المتصفح...");
    
    // 🚀 هنا سيتم قبول التسجيل بالمفتاح الجديد!
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    console.log("✅ المتصفح قبل الاشتراك، جاري الحفظ في الداتابيز...");

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

    const { error } = await supabase.from('push_subscriptions').insert({
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
      console.error('❌ فشل الحفظ في قاعدة البيانات:', error.message);
      isSubscribing = false;
      return false;
    }

    console.log('🎉 تم التسجيل وحفظ الاشتراك بنجاح!');
    isSubscribing = false;
    return true;

  } catch (error) {
    console.error('❌ فشل التسجيل:', error);
    isSubscribing = false;
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

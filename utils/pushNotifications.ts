import { supabase } from '../supabaseClient';

const VAPID_PUBLIC_KEY = 'BFg7hJozSKJ3nU4lmiKfWPwCMWW3bHHBmK-gcGheDNCXbsjjf4w9hpVhXRI_hUaGzGSx4shYYQJ8mvlbieVmGzc';

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

export async function requestNotificationPermission(userId: string | number) {
  // ✅ تحويل الـ ID إلى نص لضمان التوافق
  const validUserId = String(userId);
  console.log("🚀 تسجيل إشعارات للمستخدم:", validUserId);

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

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    console.log("📡 حفظ الاشتراك بـ ID:", validUserId);

    // ✅ حذف أي اشتراك قديم بنفس الـ endpoint لتجنب التكرار وخطأ 400
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    // ✅ استخدام insert بدلاً من upsert لتجنب مشاكل القيود (Constraints)
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: validUserId, 
        subscription_data: subscriptionJson,
        endpoint: endpoint,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ فشل الحفظ:', error.message);
      return false;
    }

    console.log('✅ تم التسجيل بنجاح!');
    return true;

  } catch (error) {
    console.error('❌ خطأ غير متوقع:', error);
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
    // 1. الحفظ في قاعدة البيانات
    const { error: dbError } = await supabase.from('notifications').insert({
      user_id: validUserId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    });

    if (dbError) console.error('Database Notification Error:', dbError);

    // 2. إرسال الـ Push Notification عبر الـ Edge Function
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: validUserId, 
          title: title,
          body: message,
          url: type === 'task' ? '/staff?tab=tasks' : '/admin?tab=tasks'
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

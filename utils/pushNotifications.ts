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

export async function requestNotificationPermission(userId: string) {
  console.log("🚀 تسجيل إشعارات للمستخدم (UUID):", userId);

  // ✅ تأكد إن الـ userId هو UUID وليس رقم
  if (!userId || userId.length < 10) {
    console.error('❌ userId غير صالح - يجب أن يكون UUID من Supabase Auth');
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

    console.log("📡 حفظ الاشتراك بـ UUID:", userId);

    // ✅ امسح أي اشتراك قديم بنفس الـ endpoint لكن بـ user_id مختلف (الرقم القديم)
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .neq('user_id', userId);

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,          // ✅ دايماً UUID من auth.uid()
        subscription_data: subscriptionJson,
        endpoint: endpoint,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      console.error('❌ فشل الحفظ:', error.message);
      return false;
    }

    console.log('✅ تم التسجيل بنجاح بالـ UUID!');
    return true;

  } catch (error) {
    console.error('❌ خطأ غير متوقع:', error);
    return false;
  }
}

export const sendSystemNotification = async (
  userId: string,   // ✅ يجب أن يكون UUID دايماً
  title: string,
  message: string,
  type: 'task' | 'task_update' | 'general' = 'general'
) => {
  try {
    const { error: dbError } = await supabase.from('notifications').insert({
      user_id: userId,
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
          userId: userId,   // ✅ UUID
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

import { supabase } from '../supabaseClient';

// ---------------------------------------------------------
// 1. الجزء الخاص بتسجيل الجهاز (موجود سابقاً)
// ---------------------------------------------------------
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
  console.log("🚀 بدء عملية تسجيل الإشعارات للمستخدم:", userId);
  
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

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    console.log("📡 جاري حفظ الاشتراك في Supabase...");

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription_data: subscriptionJson,
        endpoint: endpoint,
        device_info: {
             userAgent: navigator.userAgent,
             platform: navigator.platform,
             language: navigator.language
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, endpoint'
      });

    if (error) {
      console.error('❌ فشل الحفظ:', error.message);
      return false;
    } 
    
    return true;

  } catch (error) {
    console.error('❌ خطأ غير متوقع:', error);
    return false;
  }
}

// ---------------------------------------------------------
// 2. ✅ الجزء الجديد: دالة إرسال الإشعارات الموحدة
// ---------------------------------------------------------
export const sendSystemNotification = async (
  userId: string,
  title: string,
  message: string,
  type: 'task' | 'task_update' | 'general' = 'general'
) => {
  try {
    // أ) إرسال إشعار داخلي (Database)
    const { error: dbError } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    });

    if (dbError) console.error('Database Notification Error:', dbError);

    // ب) إرسال إشعار خارجي (Push Notification) عبر Edge Function
    try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: userId,
            title: title,
            body: message,
            url: type === 'task' ? '/staff/tasks' : '/admin/tasks'
          }
        });
    } catch (pushError) {
        console.warn('Push failed:', pushError);
    }

  } catch (error) {
    console.error('Notification System Error:', error);
  }
};

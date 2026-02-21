import { supabase } from '../supabaseClient';

// ✅ المفتاح الجديد الموثق والسليم 100%
const VAPID_PUBLIC_KEY = 'BItYbikHCzGsd-anAcw2GnKRZxfIQ4COCdK_V_i7bbRE52qf2o19Ix2pY43iH4xqmmSH1zxPcfDV5esYojEItAE';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
  if (isSubscribing) return false;
  isSubscribing = true;

  try {
    const validUserId = String(userId);
    console.log("1️⃣ بدء عملية التسجيل للمستخدم:", validUserId);

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.error("❌ المتصفح لا يدعم الإشعارات");
        isSubscribing = false;
        return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("⚠️ تم رفض إذن الإشعارات");
      isSubscribing = false;
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    console.log("2️⃣ الـ Service Worker جاهز.");

    // تفريغ أي اشتراك قديم عالق إجبارياً
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log("3️⃣ جاري مسح الاشتراك القديم من المتصفح...");
      await existingSub.unsubscribe();
    }

    console.log("4️⃣ جاري تحويل المفتاح...");
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    
    // فحص صارم لطول المفتاح (يجب أن يكون 65)
    if (applicationServerKey.length !== 65) {
        throw new Error(`طول المفتاح غير صحيح: ${applicationServerKey.length}`);
    }

    console.log("5️⃣ جاري طلب الاشتراك من سيرفرات جوجل...");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    console.log("6️⃣ تم الحصول على الاشتراك بنجاح! جاري الحفظ في الداتابيز...");

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    // مسح من الداتابيز لتجنب التكرار
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

    // الحفظ في الداتابيز
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
        console.error("❌ خطأ أثناء الحفظ في قاعدة البيانات:", error);
        isSubscribing = false;
        return false;
    }

    console.log("✅ تمت العملية بالكامل بنجاح!");
    isSubscribing = false;
    return true;

  } catch (error: any) {
    console.error("❌ فشل التسجيل:", error.message || error);
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

      if (error) console.error('Push invoke error:', error);
    } catch (pushError) {
      console.warn('Push failed:', pushError);
    }

  } catch (error) {
    console.error('Notification System Error:', error);
  }
};

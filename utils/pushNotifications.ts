import { supabase } from '../supabaseClient';

const VAPID_PUBLIC_KEY = 'BIkRpd6ma443zGKy3FqGVxXMT4JyARFx36pcc-NAYVdPiB1WTEw9m6XKJq4OXO70Vnyh0zYnE_NkjK3p3VZIINw';

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

export async function requestNotificationPermission(_ignoredUserId?: string | number) {
  if (isSubscribing) return false;
  isSubscribing = true;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      console.error("❌ لا يوجد مستخدم مسجل الدخول");
      isSubscribing = false;
      return false;
    }

    // تحديد هوية المستخدم
    let finalUserId = user.id;

    const { data: empData } = await supabase
      .from('employees')
      .select('role, employee_id')
      .eq('id', user.id)
      .maybeSingle();

    if (empData) {
      finalUserId = empData.role === 'admin' ? 'admin' : String(empData.employee_id);
    } else {
      const { data: supData } = await supabase
        .from('supervisors')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (supData) finalUserId = user.id;
    }

    const validUserId = String(finalUserId);

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.error("❌ المتصفح لا يدعم الإشعارات");
      isSubscribing = false;
      return false;
    }

    // تحقق من إذن الإشعارات - لو مرفوض مش نسأل تاني
    if (Notification.permission === 'denied') {
      console.warn("⚠️ الإشعارات مرفوضة من المستخدم");
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
    const existingSub = await registration.pushManager.getSubscription();

    // ✅ لو في اشتراك موجود في المتصفح، تحقق لو محفوظ في الداتابيز
    if (existingSub) {
      const { data: existingInDb } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', existingSub.endpoint)
        .eq('user_id', validUserId)
        .maybeSingle();

      if (existingInDb) {
        // ✅ الاشتراك موجود وصح — مش محتاج نعمل حاجة
        console.log("✅ الاشتراك موجود ومحفوظ بالفعل للمستخدم:", validUserId);
        isSubscribing = false;
        return true;
      }

      // لو مش موجود في الداتابيز — امسح وأعد التسجيل
      console.log("🔄 الاشتراك موجود في المتصفح لكن مش في الداتابيز، جاري إعادة التسجيل...");
      await existingSub.unsubscribe();
    }

    // إنشاء اشتراك جديد
    console.log("📡 جاري إنشاء اشتراك جديد...");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    // تنظيف أي اشتراكات قديمة لنفس المستخدم
    await supabase.from('push_subscriptions').delete().eq('user_id', validUserId);

    // حفظ الاشتراك الجديد
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: validUserId,
        subscription_data: JSON.stringify(subscriptionJson),
        endpoint: endpoint,
        device_info: JSON.stringify({
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("❌ خطأ أثناء الحفظ في قاعدة البيانات:", error);
      isSubscribing = false;
      return false;
    }

    console.log("✅ تم تسجيل الاشتراك بنجاح للمستخدم:", validUserId);
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
    await supabase.from('notifications').insert({
      user_id: validUserId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    });

    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: validUserId,
          title: title,
          body: message,
          url: type.includes('task') ? '/staff?tab=tasks' : '/admin?tab=tasks'
        }
      });
    } catch (pushError) {
      console.warn('Push failed:', pushError);
    }

  } catch (error) {
    console.error('Notification System Error:', error);
  }
};

import { supabase } from '../supabaseClient';

const VAPID_PUBLIC_KEY = 'BDGMfEaUdvGYra5eburOewf4B12S0m_lK_098yvNB-g0Dg3XUIfnKgU1gmjAciYg9GIqrl4jrkXyjWTnLcp_FXI';

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
    // 1. جلب بيانات المستخدم الأساسية من الـ Auth بشكل مباشر
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (!user) {
        console.error("❌ لا يوجد مستخدم مسجل الدخول");
        isSubscribing = false;
        return false;
    }

    console.log("🔍 جاري توحيد الهوية من قاعدة البيانات مباشرة...");
    let finalUserId = user.id; // نبدأ بالـ UUID كاحتياطي

    // 2. التحقق من جدول الموظفين (للموظف العادي والمدير)
    const { data: empData } = await supabase
        .from('employees')
        .select('role, employee_id')
        .eq('id', user.id)
        .maybeSingle();

    if (empData) {
        if (empData.role === 'admin') {
            finalUserId = 'admin'; // توحيد جهاز المدير ليكون دائما 'admin'
        } else {
            finalUserId = String(empData.employee_id); // توحيد جهاز الموظف ليكون رقمه (مثل 80)
        }
    } else {
        // 3. إذا لم يكن في الموظفين، نتحقق من جدول المشرفين
        const { data: supData } = await supabase
            .from('supervisors')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
        
        if (supData) {
            finalUserId = user.id; // جهاز المشرف يعتمد على الـ UUID
        }
    }

    const validUserId = String(finalUserId);
    console.log("1️⃣ الهوية الموحدة النهائية للتسجيل هي:", validUserId);

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
    
    try {
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
            console.log("🧹 جاري مسح الاشتراك القديم...");
            await existingSub.unsubscribe();
        }
    } catch(e) {}

    console.log("4️⃣ جاري طلب الاشتراك من سيرفرات جوجل...");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log("5️⃣ تم الحصول على الاشتراك بنجاح! جاري الحفظ في الداتابيز...");

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;

    // استخدام upsert بدلاً من delete ثم insert لتجنب الأخطاء
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: validUserId, 
            subscription_data: JSON.stringify(subscriptionJson), // التأكد من أنه نص
            endpoint: endpoint,
            device_info: JSON.stringify({ // التأكد من أنه نص
              userAgent: navigator.userAgent,
              platform: navigator.platform
            }),
            updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });

    if (error) {
        console.error("❌ خطأ أثناء الحفظ في قاعدة البيانات:", error);
        isSubscribing = false;
        return false;
    }

    console.log("✅ تمت العملية بالكامل بنجاح للمستخدم رقم:", validUserId);
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

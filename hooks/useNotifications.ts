import { supabase } from '../supabaseClient';

export const useNotifications = (userId: string) => {
  // مفتاح الـ VAPID العام (يجب توليده أو استبداله لاحقاً لإرسال الرسائل الحقيقية)
  // يمكنك البدء بمفتاح تجريبي
  const publicKey = 'YOUR_PUBLIC_VAPID_KEY'; 

  const subscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // طلب الاشتراك من سيرفر المتصفح
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      // حفظ البيانات في جدول push_subscriptions الذي أنشأناه في SQL
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription_data: subscription.toJSON(),
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
          }
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to subscribe to push notifications', err);
      return false;
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) return false;
    
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    
    if (permission === 'granted') {
      return await subscribeUser();
    }
    return false;
  };

  return { requestPermission, permission: Notification.permission };
};

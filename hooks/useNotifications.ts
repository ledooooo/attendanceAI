import { supabase } from '../supabaseClient';

export const useNotifications = (userId: string) => {
  // ملاحظة: هذا مفتاح تجريبي، للإنتاج يفضل توليد مفتاح خاص بك
  const publicKey = 'BEl62vp9IHZS95v5H5z6N2_t757988358485'; 

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeUser = async () => {
    try {
      if (!('serviceWorker' in navigator)) return false;
      
      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription_data: subscription, // Supabase سيتعامل معه كـ JSONB
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            last_sync: new Date().toISOString()
          }
        }, { onConflict: 'user_id, subscription_data' });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Push subscription error:', err);
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

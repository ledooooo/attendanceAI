import { supabase } from '../supabaseClient';

export const useNotifications = (userId: string) => {
  // ⚠️ استبدل النص التالي بالمفتاح العام الحقيقي الذي نسخته من الموقع
  const publicKey = 'BJ5Rx-llNAH1bWDuB6miFY2GLp6qQz3XSRWsD9_onnn430E7HZmN5w3VSR17DV9qxl341wsJjc-35lOqNTBo65k'; 

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
      
      // هنا كان يحدث الخطأ بسبب المفتاح غير الصالح
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription_data: subscription, 
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

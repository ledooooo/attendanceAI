import { useState, useEffect } from 'react';
import { requestNotificationPermission } from '../utils/pushNotifications';

export const useNotifications = (userId: string) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!userId) {
      console.warn('⚠️ لا يوجد user ID');
      return false;
    }

    const result = await requestNotificationPermission(userId);
    
    if (result) {
      setPermission('granted');
    }
    
    return result;
  };

  return { 
    requestPermission, 
    permission 
  };
};

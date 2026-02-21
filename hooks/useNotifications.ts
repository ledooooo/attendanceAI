import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { requestNotificationPermission } from '../utils/pushNotifications';

export const useNotifications = (userId: string) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. تحديث حالة الإذن عند التحميل
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // 2. ⚡ اشتراك فوري (Realtime) لجلب عدد الإشعارات غير المقروءة
  useEffect(() => {
    if (!userId) return;

    // دالة لجلب العدد الحالي
    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', String(userId)) // التأكد من استخدام المعرف الموحد
        .eq('is_read', false);
      
      if (!error) setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // إنشاء اشتراك حي: أي تغيير في جدول الإشعارات يخص هذا المستخدم
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // استماع لكل الأحداث (إضافة، تعديل، حذف)
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // عند حدوث أي تغيير، أعد جلب العدد
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // 3. طلب الإذن وربط الجهاز
  const requestPermission = async () => {
    if (!userId) {
      console.warn('⚠️ لا يوجد user ID لربط الإشعارات');
      return false;
    }

    const result = await requestNotificationPermission(String(userId));
    
    if (result) {
      setPermission('granted');
    }
    
    return result;
  };

  return { 
    requestPermission, 
    permission,
    unreadCount, // تصدير العداد لاستخدامه في شارة الجرس (Badge)
    setUnreadCount
  };
};

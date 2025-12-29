import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// رابط صوت التنبيه (يمكنك تغييره بأي رابط mp3 مباشر)
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // دالة تشغيل الصوت
  const playSound = () => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.play().catch(e => console.log('Audio play failed (interaction needed):', e));
    } catch (error) {
      console.error('Error playing sound', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;

    // جلب الإشعارات الخاصة بالمستخدم الحالي فقط
    // ملاحظة: نفترض أن user_id في جدول notifications هو نفسه id أو employee_id
    // سنستخدم employee_id الموجود في user metadata أو الـ id المباشر حسب هيكلة قاعدة بياناتك
    // هنا سنبحث باستخدام البريد الإلكتروني لجلب كود الموظف أولاً لضمان الدقة
    
    let targetId = user.id;
    
    // محاولة جلب employee_id الحقيقي من جدول الموظفين
    const { data: empData } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('email', user.email)
        .single();
    
    if (empData) targetId = empData.employee_id;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', targetId) // الفلترة
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async () => {
    if (!user) return;
    
    // نفس المنطق لجلب المعرف
    let targetId = user.id;
    const { data: empData } = await supabase.from('employees').select('employee_id').eq('email', user.email).single();
    if (empData) targetId = empData.employee_id;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', targetId)
      .eq('is_read', false);

    if (!error) {
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // --- إعداد الـ Realtime ---
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          // التحقق: هل الإشعار يخص المستخدم الحالي؟
          const newNotif = payload.new as Notification;
          
          // نحتاج للتأكد من هوية المستخدم (كود الموظف)
          let currentEmpId = user.id;
          const { data: emp } = await supabase.from('employees').select('employee_id').eq('email', user.email).single();
          if (emp) currentEmpId = emp.employee_id;

          // إذا كان الإشعار موجهاً لهذا المستخدم
          if (newNotif.user_id === currentEmpId || newNotif.user_id === 'all') {
             // 1. تشغيل الصوت
             playSound();
             
             // 2. تحديث الحالة
             setNotifications(prev => [newNotif, ...prev]);
             setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

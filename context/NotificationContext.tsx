import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sendNotification: (to: string, title: string, message: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({} as NotificationContextType);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { employeeProfile, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // معرف المستخدم الحالي لاستقبال الإشعارات (إما كود الموظف أو 'admin')
  const currentUserId = isAdmin ? 'admin' : employeeProfile?.employee_id;

  const fetchNotifications = async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setNotifications(data);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUserId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const sendNotification = async (to: string, title: string, message: string) => {
    await supabase.from('notifications').insert([{ user_id: to, title, message }]);
  };

  useEffect(() => {
    if (!currentUserId) return;

    fetchNotifications();

    // الاشتراك في التغييرات اللحظية
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          // عند وصول إشعار جديد
          const newNotif = payload.new as AppNotification;
          setNotifications(prev => [newNotif, ...prev]);
          
          // تشغيل صوت تنبيه بسيط (اختياري)
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {}); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
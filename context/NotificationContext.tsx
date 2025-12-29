import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: () => Promise<void>; // قراءة الكل
  fetchNotifications: () => Promise<void>;
  sendNotification: (userId: string, title: string, message: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const playSound = () => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.play().catch(e => console.log('Audio interaction needed:', e));
    } catch (error) {
      console.error('Error playing sound', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    let targetId = user.id;
    const { data: empData } = await supabase.from('employees').select('employee_id').eq('email', user.email).single();
    if (empData) targetId = empData.employee_id;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async () => {
    if (!user) return;
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

  const sendNotification = async (userId: string, title: string, message: string) => {
    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            title: title,
            message: message,
            is_read: false
        });
    if (error) console.error("Failed to send notification:", error);
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const newNotif = payload.new as AppNotification;
          
          let currentEmpId = user.id;
          const { data: emp } = await supabase.from('employees').select('employee_id').eq('email', user.email).single();
          if (emp) currentEmpId = emp.employee_id;

          if (newNotif.user_id === currentEmpId || newNotif.user_id === 'all') {
             playSound();
             setNotifications(prev => [newNotif, ...prev]);
             setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, fetchNotifications, sendNotification }}>
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

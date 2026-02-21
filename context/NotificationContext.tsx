import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';
import { Bell, X } from 'lucide-react';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  sendNotification: (userId: string, title: string, message: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, employeeProfile } = useAuth();
  
  // استخراج الدور من ملف الموظف
  const role = employeeProfile?.role; 

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{title: string, msg: string} | null>(null);

  const playSound = () => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.play().catch(() => {}); 
    } catch (error) { console.error("Audio playback failed:", error); }
  };

  const showToast = (title: string, msg: string) => {
      setToast({ title, msg });
      playSound();
      setTimeout(() => setToast(null), 5000);
  };

  // دالة موحدة لتحديد المعرف المستخدم في الإشعارات
  const getTargetId = () => {
    if (role === 'admin') return 'admin';
    return employeeProfile?.employee_id ? String(employeeProfile.employee_id) : user?.id;
  };

  const fetchNotifications = async () => {
    const targetId = getTargetId();
    if (!targetId) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${targetId},user_id.eq.all`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async () => {
    const targetId = getTargetId();
    if (!targetId) return;

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
    await supabase.from('notifications').insert({
        user_id: userId,
        title: title,
        message: message,
        is_read: false
    });
  };

  useEffect(() => {
    const targetId = getTargetId();
    if (!targetId) return;

    fetchNotifications();

    // إنشاء قناة اتصال حية مع فلترة من جهة السيرفر لتحسين الأداء
    const channel = supabase
      .channel(`notifs:${targetId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=in.(${targetId},all)` // استقبال ما يخصني فقط
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          showToast(newNotif.title, newNotif.message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, employeeProfile?.employee_id, role]); 

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, fetchNotifications, sendNotification }}>
      {children}
      
      {/* التنبيه البصري (Toast) */}
      {toast && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-white border-l-4 border-orange-500 shadow-2xl rounded-2xl p-4 min-w-[320px] animate-in slide-in-from-top-5 duration-300 flex items-start gap-3 border border-gray-100">
              <div className="bg-orange-100 p-2 rounded-xl shrink-0">
                  <Bell className="w-5 h-5 text-orange-600 animate-ring" />
              </div>
              <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-800 text-sm truncate">{toast.title}</h4>
                  <p className="text-gray-600 text-xs mt-1 leading-relaxed line-clamp-2">{toast.msg}</p>
              </div>
              <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                  <X className="w-4 h-4"/>
              </button>
          </div>
      )}
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

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

// رابط صوت التنبيه
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, role } = useAuth(); // نحتاج معرفة الدور (admin/user)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // حالة لعرض التنبيه المنبثق (Toast)
  const [toast, setToast] = useState<{title: string, msg: string} | null>(null);

  // تشغيل الصوت
  const playSound = () => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.play().catch(() => {}); // نتجاهل الخطأ اذا لم يتفاعل المستخدم مع الصفحة
    } catch (error) { console.error(error); }
  };

  // إظهار التنبيه المرئي لمدة 5 ثواني
  const showToast = (title: string, msg: string) => {
      setToast({ title, msg });
      playSound();
      setTimeout(() => setToast(null), 5000);
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    let targetId = user.id;

    // إذا لم يكن مديراً، نبحث عن كود الموظف الخاص به
    if (role !== 'admin') {
        const { data: empData } = await supabase.from('employees').select('employee_id').eq('email', user.email).single();
        if (empData) targetId = empData.employee_id;
    } else {
        // إذا كان مديراً، معرفه هو 'admin' لاستقبال إشعارات النظام
        targetId = 'admin';
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      // جلب الإشعارات الخاصة بالمستخدم أو العامة
      .or(`user_id.eq.${targetId},user_id.eq.all`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async () => {
    if (!user) return;
    let targetId = role === 'admin' ? 'admin' : user.id;

    if (role !== 'admin') {
         const { data: empData } = await supabase.from('employees').select('employee_id').eq('email', user.email).single();
         if (empData) targetId = empData.employee_id;
    }

    // تحديث الكل كمقروء لهذا المستخدم
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
    fetchNotifications();
    if (!user) return;

    // الاشتراك في التغييرات اللحظية
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const newNotif = payload.new as AppNotification;
          
          // تحديد هوية المستخدم الحالي لمقارنتها مع الإشعار القادم
          let myTargetId = 'admin'; // افتراضياً للمدير

          if (role !== 'admin') {
             const { data: emp } = await supabase.from('employees').select('employee_id').eq('email', user.email).single();
             if (emp) myTargetId = emp.employee_id;
             else return; // لا يوجد موظف مرتبط
          }

          // الشرط: هل الإشعار مرسل لي؟ (سواء كنت أنا الموظف أو أنا الأدمن)
          // أو هل الإشعار عام للكل 'all'
          if (newNotif.user_id === myTargetId || newNotif.user_id === 'all') {
             // 1. تحديث القائمة والعداد
             setNotifications(prev => [newNotif, ...prev]);
             setUnreadCount(prev => prev + 1);
             
             // 2. إظهار التنبيه المرئي والصوتي
             showToast(newNotif.title, newNotif.message);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, fetchNotifications, sendNotification }}>
      {children}
      
      {/* مكون التنبيه المنبثق (Toast Notification) */}
      {toast && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-white border-l-4 border-orange-500 shadow-2xl rounded-lg p-4 min-w-[300px] animate-in slide-in-from-top-5 duration-300 flex items-start gap-3">
              <div className="bg-orange-100 p-2 rounded-full">
                  <Bell className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-sm">{toast.title}</h4>
                  <p className="text-gray-600 text-xs mt-1">{toast.msg}</p>
              </div>
              <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">
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

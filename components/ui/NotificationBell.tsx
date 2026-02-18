import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Smartphone, X, Clock, CheckCircle } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useNotifications as usePush } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient'; // ✅ تأكد من استيراد Supabase

interface Props {
  onNavigate?: (tabId: string) => void;
}

export default function NotificationBell({ onNavigate }: Props) {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { user } = useAuth();
  const { requestPermission, permission } = usePush(user?.id || '');
  const [isOpen, setIsOpen] = useState(false);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);

  // 1. ✅ جلب تاريخ إنشاء حساب المستخدم لفلترة الإشعارات القديمة
  useEffect(() => {
    const fetchUserDate = async () => {
      if (!user?.id) return;
      
      // محاولة جلب التاريخ من جدول الموظفين أولاً
      let { data: empData } = await supabase.from('employees').select('created_at').eq('id', user.id).maybeSingle();
      
      // إذا لم يكن موظفاً، نجرب جدول المشرفين
      if (!empData) {
        let { data: supData } = await supabase.from('supervisors').select('created_at').eq('id', user.id).maybeSingle();
        if (supData) setUserCreatedAt(supData.created_at);
      } else {
        setUserCreatedAt(empData.created_at);
      }
    };
    fetchUserDate();
  }, [user?.id]);

  // 2. ✅ فلترة الإشعارات: عرض فقط ما هو أحدث من تاريخ إنشاء الحساب
  const filteredNotifications = useMemo(() => {
    if (!userCreatedAt) return notifications;
    const userJoinDate = new Date(userCreatedAt).getTime();
    
    return notifications.filter(n => {
      const notifDate = new Date(n.created_at).getTime();
      return notifDate >= userJoinDate;
    });
  }, [notifications, userCreatedAt]);

  const handleToggle = () => {
    if (!isOpen && unreadCount > 0) markAsRead();
    setIsOpen(!isOpen);
  };

  const handlePushActivate = async () => {
    const success = await requestPermission();
    if (success) alert('تم ربط جهازك بنجاح! ستصلك التنبيهات حتى والموقع مغلق.');
  };

  const handleNotificationClick = (notif: any) => {
    setIsOpen(false);
    const isAdmin = window.location.pathname.includes('admin');
    let targetTab = '';

    switch (notif.type) {
      case 'leave_request':
      case 'leave_update':
        targetTab = isAdmin ? 'leaves' : 'requests-history';
        break;
      case 'message':
        targetTab = isAdmin ? 'all_messages' : 'messages';
        break;
      case 'ovr_report':
        targetTab = isAdmin ? 'quality' : 'quality-manager-tab'; 
        break;
      case 'ovr_reply':
        targetTab = 'ovr';
        break;
      case 'task':
      case 'task_update':
        targetTab = 'tasks';
        break;
      case 'training':
        targetTab = 'training';
        break;
      case 'reward_update':
         targetTab = 'store';
         break;
      default:
        targetTab = isAdmin ? 'home' : 'news';
        break;
    }

    if (onNavigate && targetTab) {
        onNavigate(targetTab);
    } else if (targetTab) {
        window.location.href = isAdmin ? `/admin?tab=${targetTab}` : `/staff?tab=${targetTab}`;
    }
  };

  return (
    <div className="relative">
      <button onClick={handleToggle} className="p-2 rounded-xl hover:bg-gray-100 relative transition-colors">
        <Bell className={`w-5 h-5 md:w-6 md:h-6 ${unreadCount > 0 ? 'text-orange-600 animate-pulse' : 'text-gray-600'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[9px] md:text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
            {/* خلفية معتمة للموبايل فقط لإغلاق القائمة */}
            <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] md:hidden" onClick={() => setIsOpen(false)} />
            
            {/* ✅ الحاوية: fixed في الموبايل (منتصف الشاشة)، absolute في الديسك توب (تحت الزر) */}
            <div className={`
                fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm 
                md:absolute md:top-full md:left-0 md:translate-x-0 md:translate-y-2 md:w-80
                bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95
            `}>
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-gray-700 text-sm flex items-center gap-2">
                        <Bell className="w-4 h-4 text-orange-500"/> التنبيهات
                    </h3>
                    <button 
                    onClick={handlePushActivate}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                        permission === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white shadow-sm'
                    }`}
                    >
                    <Smartphone size={12}/> {permission === 'granted' ? 'مفعل' : 'تفعيل'}
                    </button>
                    {/* زر إغلاق للموبايل */}
                    <button onClick={() => setIsOpen(false)} className="md:hidden p-1 bg-white rounded-full text-gray-400">
                        <X size={16}/>
                    </button>
                </div>

                <div className="max-h-[60vh] md:max-h-80 overflow-y-auto custom-scrollbar">
                    {filteredNotifications.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-xs italic font-bold">
                        لا توجد إشعارات جديدة حالياً ✨
                    </div>
                    ) : (
                    filteredNotifications.map((notif) => (
                        <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)} 
                        className={`p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.is_read ? 'bg-orange-50/40 border-l-4 border-l-orange-400' : ''}`}
                        >
                        <div className="flex justify-between items-start mb-1">
                            <h4 className={`text-xs ${!notif.is_read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>{notif.title}</h4>
                            {!notif.is_read && <span className="w-2 h-2 bg-orange-500 rounded-full"></span>}
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{notif.message}</p>
                        <div className="flex items-center justify-between text-[9px] text-gray-400">
                            <div className="flex items-center gap-1">
                                <Clock size={10}/> {new Date(notif.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute:'2-digit' })}
                            </div>
                            <span>{new Date(notif.created_at).toLocaleDateString('ar-EG')}</span>
                        </div>
                        </div>
                    ))
                    )}
                </div>
            </div>
        </>
      )}
      
      {/* غطاء لإغلاق القائمة في الديسك توب */}
      {isOpen && <div className="hidden md:block fixed inset-0 z-[80]" onClick={() => setIsOpen(false)}/>}
    </div>
  );
}

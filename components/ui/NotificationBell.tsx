import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Smartphone, X, Clock, ListTodo, BookOpen, CheckCircle } from 'lucide-react';
import { useNotifications as usePush } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';

interface Props {
  onNavigate?: (tabId: string) => void;
}

export default function NotificationBell({ onNavigate }: Props) {
  const { user } = useAuth();
  const { requestPermission, permission } = usePush(user?.id || '');
  const [isOpen, setIsOpen] = useState(false);
  
  // استخدام حالة محلية لضمان التحديث الفوري
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. جلب تاريخ إنشاء الحساب (مرة واحدة)
  useEffect(() => {
    const fetchUserDate = async () => {
      if (!user?.id) return;
      // محاولة جلب التاريخ من الموظفين أو المشرفين
      let { data: empData } = await supabase.from('employees').select('created_at').eq('id', user.id).maybeSingle();
      if (!empData) {
        let { data: supData } = await supabase.from('supervisors').select('created_at').eq('id', user.id).maybeSingle();
        if (supData) setUserCreatedAt(supData.created_at);
      } else {
        setUserCreatedAt(empData.created_at);
      }
    };
    fetchUserDate();
    
    // تحضير صوت التنبيه
    audioRef.current = new Audio('/notification.mp3');
  }, [user?.id]);

  // 2. دالة جلب الإشعارات
  const fetchNotifications = async () => {
    if (!user?.id) return;
    
    let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    // فلترة بالتاريخ إذا وجد (لزيادة الأمان، رغم أن الفلترة بالذاكرة أدناه أسرع للعرض)
    if (userCreatedAt) {
        query = query.gte('created_at', userCreatedAt);
    }

    const { data } = await query;
    if (data) setNotifications(data);
  };

  // 3. الاشتراك في التحديثات اللحظية (Realtime) - الحل الجذري لوصول الإشعار
  useEffect(() => {
    if (!user?.id) return;

    // جلب أولي
    fetchNotifications();

    // اشتراك
    const channel = supabase.channel(`notifs_${user.id}`)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, 
            (payload) => {
                // عند وصول إشعار جديد
                setNotifications(prev => [payload.new, ...prev]);
                // تشغيل الصوت
                audioRef.current?.play().catch(() => {});
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, userCreatedAt]);

  // 4. الفلترة النهائية (لضمان عدم عرض القديم جداً)
  const filteredNotifications = useMemo(() => {
    if (!userCreatedAt) return notifications;
    const userJoinDate = new Date(userCreatedAt).getTime();
    return notifications.filter(n => new Date(n.created_at).getTime() >= userJoinDate);
  }, [notifications, userCreatedAt]);

  const unreadCount = useMemo(() => filteredNotifications.filter(n => !n.is_read).length, [filteredNotifications]);

  // 5. تحديث القراءة
  const handleToggle = async () => {
    if (!isOpen && unreadCount > 0) {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
    setIsOpen(!isOpen);
  };

  const handlePushActivate = async () => {
    const success = await requestPermission();
    if (success) alert('تم ربط جهازك بنجاح!');
  };

  // 6. التوجيه الذكي (بما فيه المسابقات)
  const handleNotificationClick = (notif: any) => {
    setIsOpen(false);
    const isAdmin = window.location.pathname.includes('admin');
    let targetTab = '';
    const type = notif.type || '';

    if (type.includes('task')) targetTab = 'tasks';
    else if (type.includes('message')) targetTab = isAdmin ? 'all_messages' : 'messages';
    else if (type.includes('ovr_report')) targetTab = isAdmin ? 'quality' : 'quality-manager-tab';
    else if (type.includes('ovr_reply')) targetTab = 'ovr';
    else if (type.includes('training')) targetTab = 'training';
    else if (type.includes('reward')) targetTab = 'store';
    else if (type.includes('leave')) targetTab = isAdmin ? 'leaves' : 'requests-history';
    // ✅ إضافة توجيه المسابقة
    else if (type.includes('competition')) targetTab = isAdmin ? 'competitions' : 'news'; 
    else targetTab = isAdmin ? 'home' : 'news';

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
            <div className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] md:hidden" onClick={() => setIsOpen(false)} />
            
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
      
      {isOpen && <div className="hidden md:block fixed inset-0 z-[80]" onClick={() => setIsOpen(false)}/>}
    </div>
  );
}

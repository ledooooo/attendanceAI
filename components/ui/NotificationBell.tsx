import React, { useState } from 'react';
import { Bell, Smartphone, X, Clock } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useNotifications as usePush } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';

// إضافة onNavigate لتفعيل التنقل بين التبويبات
interface Props {
  onNavigate?: (tabId: string) => void;
}

export default function NotificationBell({ onNavigate }: Props) {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { user } = useAuth();
  const { requestPermission, permission } = usePush(user?.id || '');
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (!isOpen && unreadCount > 0) markAsRead();
    setIsOpen(!isOpen);
  };

  const handlePushActivate = async () => {
    const success = await requestPermission();
    if (success) alert('تم ربط جهازك بنجاح! ستصلك التنبيهات حتى والموقع مغلق.');
  };

  // ✅ الدالة الذكية لتوجيه الإشعارات حسب الصلاحية والنوع
  const handleNotificationClick = (notif: any) => {
    setIsOpen(false); // قفل القائمة المنسدلة

    // تحديد هل نحن في صفحة الإدارة أم الموظف
    const isAdmin = window.location.pathname.includes('admin');
    let targetTab = '';

    // تحديد التبويب المستهدف بناءً على نوع الإشعار
    switch (notif.type) {
      case 'leave_request': // طلب إجازة جديد (للمدير)
      case 'leave_update':  // تحديث حالة إجازة (للموظف)
        targetTab = isAdmin ? 'leaves' : 'requests-history';
        break;
      
      case 'message': // رسائل ومحادثات
        targetTab = isAdmin ? 'all_messages' : 'messages';
        break;
      
      case 'ovr_report': // بلاغ OVR جديد (لمدير الجودة)
        targetTab = isAdmin ? 'quality' : 'quality-manager-tab'; 
        break;
      
      case 'ovr_reply': // رد على بلاغ (للموظف)
        targetTab = 'ovr';
        break;
      
      case 'task': // تكليفات جديدة أو تحديث عليها
      case 'task_update':
        targetTab = 'tasks';
        break;
      
      case 'training': // مركز التدريب
        targetTab = 'training';
        break;

      case 'reward_update': // تحديثات متجر الجوائز
         targetTab = 'store';
         break;

      default:
        // في حالة إشعار عام لا يحتاج توجيه معين
        targetTab = isAdmin ? 'home' : 'news';
        break;
    }

    // التنفيذ الفعلي للتوجيه
    if (onNavigate && targetTab) {
        onNavigate(targetTab);
    } else if (targetTab) {
        // لو الخاصية onNavigate غير موجودة (مثلاً تم فتح الرابط من خارج التطبيق)
        window.location.href = isAdmin ? `/admin?tab=${targetTab}` : `/staff?tab=${targetTab}`;
    }
  };

  return (
    <div className="relative">
      <button onClick={handleToggle} className="p-2 rounded-xl hover:bg-gray-100 relative transition-colors">
        <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-orange-600 animate-pulse' : 'text-gray-600'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-black text-gray-700 text-sm">التنبيهات</h3>
            <button 
              onClick={handlePushActivate}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                permission === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white shadow-sm'
              }`}
            >
              <Smartphone size={12}/> {permission === 'granted' ? 'تنبيه الموبايل مفعل' : 'تفعيل تنبيه الموبايل'}
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-xs italic">لا توجد إشعارات حالياً</div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)} // ✅ تفعيل دالة التوجيه عند الضغط
                  className={`p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.is_read ? 'bg-orange-50/30' : ''}`}
                >
                  <h4 className="font-bold text-xs text-gray-800 mb-1">{notif.title}</h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{notif.message}</p>
                  <div className="flex items-center gap-1 text-[9px] text-gray-300 mt-2">
                    <Clock size={10}/> {new Date(notif.created_at).toLocaleTimeString('ar-EG')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}/>}
    </div>
  );
}

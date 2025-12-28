import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
// التصحيح هنا: استخدام ../../ للرجوع لمجلد src ثم الدخول لـ context
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`relative p-3 rounded-2xl transition-all duration-300 ${isOpen ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
      >
        <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'animate-pulse-slow' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm transform translate-x-1 -translate-y-1">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-4 w-80 md:w-96 bg-white rounded-[25px] shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 origin-top-left">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-sm">
            <h3 className="font-black text-gray-800 flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600"/> الإشعارات
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead} 
                className="text-[10px] bg-white border border-gray-200 px-3 py-1.5 rounded-full font-bold text-gray-500 hover:text-emerald-600 hover:border-emerald-200 transition-all flex items-center gap-1 shadow-sm"
              >
                <Check className="w-3 h-3"/> تحديد الكل كمقروء
              </button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
            {notifications.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                    <Bell className="w-8 h-8 text-gray-300"/>
                </div>
                <p className="text-gray-400 font-bold text-sm">لا توجد إشعارات جديدة</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                  className={`relative p-4 rounded-2xl transition-all cursor-pointer group ${!notif.is_read ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex gap-4">
                    <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${!notif.is_read ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-200'}`}></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                          <h4 className={`text-sm mb-1 ${!notif.is_read ? 'font-black text-gray-900' : 'font-bold text-gray-500'}`}>
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-gray-400 font-mono font-bold whitespace-nowrap mr-2">
                            {new Date(notif.created_at).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                      </div>
                      <p className={`text-xs leading-relaxed ${!notif.is_read ? 'text-gray-600 font-medium' : 'text-gray-400'}`}>{notif.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
             <button onClick={() => setIsOpen(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">إغلاق القائمة</button>
          </div>
        </div>
      )}
    </div>
  );
}
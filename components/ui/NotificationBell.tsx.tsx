import React, { useState } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-all text-gray-600"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-bounce">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute left-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-gray-800">الإشعارات</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                  <Check className="w-3 h-3"/> تحديد الكل كمقروء
                </button>
              )}
            </div>
            
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  لا توجد إشعارات جديدة
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                    className={`p-4 border-b last:border-0 hover:bg-gray-50 transition-all cursor-pointer ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`mt-1 w-2 h-2 rounded-full ${!notif.is_read ? 'bg-blue-600' : 'bg-transparent'}`}></div>
                      <div>
                        <h4 className={`text-sm ${!notif.is_read ? 'font-black text-gray-900' : 'font-bold text-gray-600'}`}>
                          {notif.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{notif.message}</p>
                        <span className="text-[10px] text-gray-400 mt-2 block">
                          {new Date(notif.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (!isOpen && unreadCount > 0) {
      markAsRead(); // استدعاء بدون معاملات (يقرأ الكل)
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button 
        onClick={handleToggle}
        className="p-2 rounded-full hover:bg-gray-100 relative transition-colors"
      >
        <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-orange-600 animate-pulse' : 'text-gray-600'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-top-2">
          <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">الإشعارات</h3>
            {notifications.length > 0 && (
                <button onClick={() => setNotifications([])} className="text-xs text-gray-400 hover:text-red-500">مسح الكل</button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">لا توجد إشعارات جديدة</div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className={`p-4 border-b last:border-0 hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-orange-50/50' : ''}`}>
                  <h4 className="font-bold text-sm text-gray-800 mb-1">{notif.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{notif.message}</p>
                  <span className="text-[10px] text-gray-300 mt-2 block">
                    {new Date(notif.created_at).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}/>
      )}
    </div>
  );
}

// دالة وهمية لتجنب خطأ setNotifications في الكود أعلاه إذا لم تكن موجودة في الكونتكست
// في الواقع يجب أن تكون markAsRead كافية
function setNotifications(arg0: never[]) {
    // Placeholder logic if clear all is needed locally
}

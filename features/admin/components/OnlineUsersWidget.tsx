import React, { useState, useEffect } from 'react';
// تأكد من مسار supabase حسب هيكل مشروعك
// إذا كان الملف في features/admin/components فإن الرجوع 3 مرات صحيح للوصول لـ src
import { supabase } from '../../../supabaseClient'; 
import { Wifi } from 'lucide-react';

export default function OnlineUsersWidget() {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    const channel = supabase.channel('online_users_room');

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users = Object.values(newState).map((u: any) => u[0]); 
        setOnlineUsers(users);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return (
    <div className="bg-white p-4 rounded-[2rem] border border-emerald-100 shadow-sm h-full">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
          <Wifi className="w-4 h-4 text-green-500 animate-pulse" /> المتواجدون الآن
        </h3>
        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-black">
          {onlineUsers.length}
        </span>
      </div>
      
      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar">
        {onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-gray-400 gap-2">
             <div className="w-2 h-2 rounded-full bg-gray-300"></div>
             <p className="text-[10px]">لا يوجد نشاط حالياً</p>
          </div>
        ) : (
          onlineUsers.map((u) => (
            <div key={u.user_id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]"></div>
                </div>
                <div className="flex flex-col truncate">
                    <span className="text-xs font-bold text-gray-700 truncate max-w-[100px]" title={u.name}>
                        {u.name}
                    </span>
                    <span className="text-[9px] text-gray-400 truncate">
                        {u.role}
                    </span>
                </div>
              </div>
              <span className="text-[9px] text-gray-400 font-mono">
                {new Date(u.online_at).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Users, Wifi } from 'lucide-react';

export default function OnlineUsersWidget() {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    const channel = supabase.channel('online_users_room');

    channel
      .on('presence', { event: 'sync' }, () => {
        // تحويل الحالة (State) إلى مصفوفة بسيطة
        const newState = channel.presenceState();
        const users = Object.values(newState).map((u: any) => u[0]); // Supabase returns array of arrays
        setOnlineUsers(users);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return (
    <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
      <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-green-500 animate-pulse" /> المتواجدون الآن
        </h3>
        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-black">
          {onlineUsers.length}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
        {onlineUsers.length === 0 ? (
          <p className="text-xs text-gray-400 w-full text-center">لا يوجد أحد متصل حالياً</p>
        ) : (
          onlineUsers.map((u) => (
            <div key={u.user_id} className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_5px_rgba(34,197,94,0.6)]"></div>
              <span className="text-xs font-bold text-gray-700 truncate max-w-[120px]" title={u.email}>
                {/* هنا يفضل عرض الاسم الحقيقي بدلاً من الايميل */}
                {u.email.split('@')[0]} 
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

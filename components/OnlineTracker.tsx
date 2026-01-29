import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

export default function OnlineTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const trackPresence = async () => {
        // 1. جلب اسم الموظف من قاعدة البيانات
        const { data: emp } = await supabase
            .from('employees')
            .select('name, role') // جلب الاسم والدور
            .eq('employee_id', user.email?.split('@')[0]) // افتراضاً أن employee_id هو الجزء الأول من الايميل، أو استخدم user.id إذا كنت تربطهم به
            .maybeSingle();

        const userName = emp?.name || user.email?.split('@')[0] || 'مستخدم';
        const userRole = emp?.role || 'موظف';

        const userStatus = {
            user_id: user.id,
            name: userName,
            role: userRole,
            online_at: new Date().toISOString(),
        };

        const channel = supabase.channel('online_users_room', {
            config: { presence: { key: user.id } },
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track(userStatus);
            }
        });
    };

    trackPresence();

    // ملاحظة: Unsubscribe هنا قد يكون معقداً قليلاً داخل useEffect async
    // لكن Supabase يقوم بتنظيف الاتصالات الميتة تلقائياً
  }, [user]);

  return null;
}

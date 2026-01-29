import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

export default function OnlineTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // 1. تعريف دالة تحديث قاعدة البيانات (Heartbeat)
    const updateLastSeenInDB = async () => {
      // نستخدم الإيميل كمعرف للربط (أو يمكن استخدام user_id لو تم ربطه)
      if (user.email) {
        await supabase
          .from('employees')
          .update({ last_seen: new Date().toISOString() })
          .eq('email', user.email); 
      }
    };

    // 2. إعداد الـ Presence (المتواجدون الآن) - الكود القديم كما هو
    const trackPresence = async () => {
      const { data: emp } = await supabase
        .from('employees')
        .select('name, role, employee_id')
        .eq('email', user.email)
        .maybeSingle();

      const userStatus = {
        user_id: user.id,
        name: emp?.name || user.email?.split('@')[0] || 'مستخدم',
        role: emp?.role || 'غير محدد',
        online_at: new Date().toISOString(),
      };

      const channel = supabase.channel('online_users_room', {
        config: {
          presence: { key: user.id },
        },
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userStatus);
        }
      });
    };

    // --- التنفيذ ---
    
    // أ) تشغيل Presence
    trackPresence();

    // ب) تحديث قاعدة البيانات فوراً عند الدخول
    updateLastSeenInDB();

    // ج) تحديث قاعدة البيانات كل 5 دقائق (Heartbeat) للحفاظ على التوقيت حديثاً
    // هذا يمنع الضغط على القاعدة (يكتب مرة كل 5 دقائق بدلاً من كل ثانية)
    const intervalId = setInterval(() => {
      updateLastSeenInDB();
    }, 5 * 60 * 1000); // 5 دقائق

    // تنظيف عند الخروج
    return () => {
      clearInterval(intervalId);
      // يمكن هنا محاولة إرسال تحديث أخير، لكنه غير مضمون دائماً عند غلق المتصفح
    };
  }, [user]);

  return null;
}

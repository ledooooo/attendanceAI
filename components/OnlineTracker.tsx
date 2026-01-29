import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

export default function OnlineTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const trackPresence = async () => {
      // 1. محاولة جلب بيانات الموظف بناءً على الإيميل أو الـ ID
      // سنفترض أن الربط يتم عن طريق الإيميل أو employee_id الموجود في الميتاداتا
      // أو سنبحث في جدول employees عن هذا المستخدم
      
      // سنبحث في جدول الموظفين عن الموظف المرتبط بهذا الحساب
      // (تأكد أن لديك عمود يربط المستخدم بالموظف، مثلاً email أو user_uuid)
      const { data: emp } = await supabase
        .from('employees')
        .select('name, role, employee_id')
        .eq('email', user.email) // أو استخدم الطريقة التي تربط بها الموظفين
        .maybeSingle();

      // تجهيز البيانات التي سيتم إرسالها (بدون حفظها في قاعدة البيانات)
      const userStatus = {
        user_id: user.id,
        name: emp?.name || user.email?.split('@')[0] || 'مستخدم', // الاسم الحقيقي أو جزء من الايميل
        role: emp?.role || 'غير محدد',
        online_at: new Date().toISOString(),
      };

      // 2. الاتصال بقناة التواجد
      const channel = supabase.channel('online_users_room', {
        config: {
          presence: {
            key: user.id, // مفتاح فريد لمنع التكرار
          },
        },
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userStatus);
        }
      });
    };

    trackPresence();

    // Supabase يقوم بتنظيف القناة تلقائياً عند إغلاق المتصفح
  }, [user]);

  return null; // لا يعرض شيئاً، يعمل في الخلفية
}

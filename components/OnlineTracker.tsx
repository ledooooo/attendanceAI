import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // تأكد من المسار
import { supabase } from '../supabaseClient'; // تأكد من المسار

export default function OnlineTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // استخراج بيانات الموظف من الميتاداتا أو يمكنك جلبها من جدول الموظفين
    // هنا سنفترض أننا نرسل الـ ID والبريد الإلكتروني، ويمكنك تحسينها لإرسال الاسم
    const userStatus = {
      user_id: user.id,
      email: user.email,
      online_at: new Date().toISOString(),
    };

    // الاتصال بقناة التواجد العامة
    const channel = supabase.channel('online_users_room', {
      config: {
        presence: {
          key: user.id, // مفتاح فريد لكل مستخدم
        },
      },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // بمجرد الاتصال، أرسل بياناتي
        await channel.track(userStatus);
      }
    });

    // تنظيف الاتصال عند الخروج أو غلق الصفحة
    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  return null; // هذا المكون لا يعرض شيئاً، هو يعمل في الخلفية فقط
}

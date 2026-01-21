import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';
import { supabase } from './supabaseClient';
import { requestNotificationPermission } from './utils/pushNotifications'; // تأكد أنك أنشأت هذا الملف

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin } = useAuth();

  // 1. تسجيل Service Worker فور تحميل التطبيق
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ Service Worker Registered:', reg.scope))
        .catch(err => console.error('❌ Service Worker Error:', err));
    }
  }, []);

  // 2. 🔔 طلب إذن الإشعارات تلقائياً بعد تسجيل الدخول
  useEffect(() => {
    // نستخدم user.id الخاص بـ Supabase Auth لربط الاشتراك بحساب المستخدم الآمن
    if (user?.id) {
      // ننتظر 3 ثوانٍ حتى لا نربك المستخدم فور فتح الموقع
      const timer = setTimeout(() => {
        console.log("🔔 جاري تهيئة الإشعارات للمستخدم:", user.id);
        requestNotificationPermission(user.id);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // 3. 🛠️ حل مشكلة "جاري التحميل" المعلقة
  useEffect(() => {
    let timer: any;
    if (loading) {
      // إذا استمر التحميل أكثر من 10 ثواني، نعتبر أن هناك خطأ في الكاش
      timer = setTimeout(() => {
        console.warn("⚠️ التحميل استغرق وقتاً طويلاً، جاري إعادة الضبط...");
        
        // مسح التخزين المحلي والتوكن
        localStorage.removeItem('sb-dyrolfnfuaifzguaxtgs-auth-token'); // استبدل بالاسم الصحيح للتوكن في مشروعك إذا اختلف
        localStorage.clear();
        
        // إعادة تحميل الصفحة
        window.location.reload();
      }, 10000); 
    }
    return () => clearTimeout(timer);
  }, [loading]);

  // --- واجهات العرض ---

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-400 text-sm font-bold">جاري استعادة الجلسة...</p>
        
        {/* زر طوارئ للمستخدم */}
        <button 
          onClick={() => window.location.reload()} 
          className="mt-8 text-xs text-emerald-600 underline hover:text-emerald-800 transition-colors"
        >
          اضغط هنا إذا تأخر التحميل
        </button>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
        <h2 className="text-xl font-bold text-gray-800 mb-2">جاري التحقق من بيانات الموظف...</h2>
        <p className="text-gray-500 mb-6 text-sm">إيميلك ({user.email}) غير مرتبط بملف موظف.</p>
        <button 
            onClick={() => supabase.auth.signOut()} 
            className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-gray-900"
        >
            تسجيل خروج
        </button>
      </div>
    );
  }

  return isAdmin ? <AdminDashboard /> : <StaffDashboard employee={employeeProfile} />;
};

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

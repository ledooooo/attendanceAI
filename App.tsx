import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';
import { supabase } from './supabaseClient';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin } = useAuth();

  // تسجيل Service Worker فور تحميل التطبيق
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ Service Worker جاهز:', reg.scope))
        .catch(err => console.error('❌ فشل تسجيل SW:', err));
    }
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-400 text-sm font-bold">جاري استعادة الجلسة...</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
        <h2 className="text-xl font-bold text-gray-800 mb-2">جاري التحقق من بيانات الموظف...</h2>
        <p className="text-gray-500 mb-6 text-sm">إيميلك ({user.email}) غير مرتبط بملف موظف.</p>
        <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold text-sm">تسجيل خروج</button>
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

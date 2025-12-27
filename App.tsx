import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin } = useAuth();

  // شاشة التحميل
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-6 font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-bold animate-pulse">جاري التحميل...</p>
        </div>
        
        {/* زر الطوارئ: يظهر دائماً في شاشة التحميل */}
        <button 
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace('/');
          }}
          className="text-xs text-red-500 underline hover:text-red-700 cursor-pointer"
        >
          هل استغرق الأمر وقتاً طويلاً؟ اضغط هنا لإعادة التشغيل
        </button>
      </div>
    );
  }

  // 1. غير مسجل -> صفحة الدخول
  if (!user) return <LoginPage />;

  // 2. مسجل لكن بدون ملف (حساب غير مرتبط)
  if (!employeeProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4 font-sans text-center" dir="rtl">
        <div className="bg-red-50 p-4 rounded-full mb-4 text-3xl">⚠️</div>
        <h2 className="text-xl font-black text-gray-800 mb-2">حساب غير مرتبط</h2>
        <p className="text-gray-500 mb-6 max-w-sm text-sm leading-relaxed">
          أهلاً بك. البريد <b>{user.email}</b> مسجل، ولكن لا توجد بيانات وظيفية مرتبطة به. يرجى التواصل مع المدير.
        </p>
        <button 
          onClick={() => {
            supabase.auth.signOut().then(() => window.location.replace('/'));
          }}
          className="bg-gray-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-900 transition-all text-sm"
        >
          تسجيل خروج
        </button>
      </div>
    );
  }

  // 3. التوجيه
  return isAdmin ? <AdminDashboard /> : <StaffDashboard employee={employeeProfile} />;
};

// الاستيراد المباشر لـ supabase لاستخدامه في زر الطوارئ الداخلي
import { supabase } from './supabaseClient';

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
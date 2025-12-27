import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';
import { supabase } from './supabaseClient'; // للاستخدام المباشر في الطوارئ

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin, signOut } = useAuth();
  const [retryCount, setRetryCount] = useState(0);

  // شاشة التحميل (تظهر فقط عند بدء التشغيل)
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 font-sans" dir="rtl">
        <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-bold">جاري استعادة الجلسة...</p>
      </div>
    );
  }

  // 1. المستخدم غير مسجل دخول
  if (!user) {
    return <LoginPage />;
  }

  // 2. المستخدم مسجل دخول، لكن لم يتم جلب بيانات الموظف
  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">تنبيه حساب</h2>
        <p className="text-gray-600 mb-6 max-w-md leading-relaxed">
          أهلاً بك. تم تسجيل دخولك بالبريد <b>{user.email}</b> بنجاح.<br/>
          ولكن لم يتم العثور على ملف وظيفي مرتبط بهذا البريد.
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
                onClick={() => window.location.reload()} 
                className="bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg"
            >
                تحديث الصفحة والمحاولة مجدداً
            </button>
            <button 
                onClick={signOut} 
                className="bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200"
            >
                تسجيل خروج
            </button>
        </div>
      </div>
    );
  }

  // 3. الدخول الناجح
  return isAdmin ? <AdminDashboard /> : <StaffDashboard employee={employeeProfile} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
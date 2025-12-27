import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin, signOut } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <p className="text-gray-500">جاري التحميل...</p>
        {/* زر طوارئ للخروج إذا علق التطبيق */}
        <button 
          onClick={() => { localStorage.clear(); window.location.reload(); }} 
          className="text-sm text-red-500 underline cursor-pointer hover:text-red-700"
        >
          هل توقف التطبيق؟ اضغط هنا لإعادة التعيين
        </button>
      </div>
    );
  }

  // 1. إذا لم يسجل الدخول
  if (!user) {
    return <LoginPage />;
  }

  // 2. حساب غير مرتبط بموظف
  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-4" dir="rtl">
        <h2 className="text-2xl font-black text-red-600 mb-2">⚠️ حساب غير مرتبط</h2>
        <p className="text-gray-600 mb-4">
          أهلاً بك. البريد الإلكتروني <b>({user.email})</b> مسجل في النظام،<br/>
          ولكنه غير مرتبط بملف موظف أو صلاحية مدير في قاعدة البيانات.
        </p>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800 mb-6 max-w-md">
          <b>للمدير:</b> تأكد من إضافة هذا الإيميل في جدول الموظفين (employees) وتعيين Role = admin.
        </div>
        <button 
            onClick={signOut} 
            className="px-8 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-all shadow-lg"
        >
            تسجيل خروج
        </button>
      </div>
    );
  }

  // 3. التوجيه
  if (isAdmin) {
    return <AdminDashboard />;
  } else {
    return <StaffDashboard employee={employeeProfile} />;
  }
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
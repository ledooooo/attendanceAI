import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;
  }

  // 1. إذا لم يسجل الدخول -> صفحة الدخول
  if (!user) {
    return <LoginPage />;
  }

  // 2. إذا سجل الدخول ولكن بريده غير موجود في جدول الموظفين
  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-black text-red-600 mb-2">حساب غير مرتبط</h2>
        <p className="text-gray-600">هذا البريد الإلكتروني ({user.email}) غير مسجل في قاعدة بيانات الموظفين.</p>
        <p className="text-gray-500 text-sm mt-2">يرجى مراجعة إدارة الموارد البشرية.</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-6 px-6 py-2 bg-gray-800 text-white rounded-lg">خروج</button>
      </div>
    );
  }

  // 3. التوجيه حسب الصلاحية (Role)
  if (isAdmin) {
    return <AdminDashboard />;
  } else {
    // نمرر بيانات الموظف مباشرة للصفحة
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
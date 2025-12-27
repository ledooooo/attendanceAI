import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin, signOut } = useAuth();

  // 1. شاشة التحميل (تظهر أثناء جلب البيانات عند الريفريش)
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  // 2. إذا لم يكن مسجلاً للدخول -> صفحة الدخول
  if (!user) {
    return <LoginPage />;
  }

  // 3. مسجل دخول ولكن البيانات لم تأتِ بعد (الحالة التي تضايقك)
  if (!employeeProfile) {
    // سنحاول الحل التلقائي:
    // نعرض رسالة صغيرة وبزر واحد لإعادة المحاولة أو الخروج
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
        <div className="animate-pulse mb-4">
           <span className="text-4xl">🔍</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">جاري مزامنة بيانات الحساب...</h2>
        <p className="text-gray-500 mb-6 text-sm">
           البريد المسجل: {user.email} <br/>
           إذا استمرت هذه الشاشة طويلاً، فقد يكون الحساب غير مفعل من الإدارة.
        </p>
        
        <div className="flex gap-3">
            <button 
                onClick={() => window.location.reload()} 
                className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 shadow-sm"
            >
                تحديث الصفحة
            </button>
            <button 
                onClick={signOut} 
                className="bg-gray-100 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-200"
            >
                تسجيل خروج
            </button>
        </div>
      </div>
    );
  }

  // 4. الدخول الناجح
  return isAdmin ? <AdminDashboard /> : <StaffDashboard employee={employeeProfile} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
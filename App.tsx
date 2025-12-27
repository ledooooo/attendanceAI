import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin, signOut } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
            <p className="text-gray-500 font-bold animate-pulse">جاري الاتصال بالنظام...</p>
        </div>
        
        {/* زر طوارئ للخروج إذا علق التطبيق */}
        <button 
          onClick={signOut} 
          className="text-sm text-red-500 font-bold border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-all"
        >
          إلغاء وتسجيل خروج
        </button>
      </div>
    );
  }

  // 1. غير مسجل دخول
  if (!user) return <LoginPage />;

  // 2. مسجل دخول لكن ليس موظفاً (حالة نادرة)
  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
        <div className="bg-red-50 p-6 rounded-full mb-4"><span className="text-4xl">⚠️</span></div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">حساب غير مرتبط</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          أهلاً بك. البريد الإلكتروني <b>({user.email})</b> مسجل لدينا، ولكن لم يتم ربطه بملف موظف حتى الآن.
        </p>
        <button onClick={signOut} className="bg-gray-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-900 transition-all shadow-lg">
            تسجيل خروج
        </button>
      </div>
    );
  }

  // 3. التوجيه الصحيح
  return isAdmin ? <AdminDashboard /> : <StaffDashboard employee={employeeProfile} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
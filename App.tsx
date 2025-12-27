import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin, signOut } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 font-sans" dir="rtl">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-bold text-sm">جاري التحميل...</p>
      </div>
    );
  }

  // 1. غير مسجل دخول
  if (!user) return <LoginPage />;

  // 2. مسجل دخول لكن بدون بروفايل (مشكلة في الربط)
  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
        <h2 className="text-xl font-black text-gray-800 mb-2">تنبيه</h2>
        <p className="text-gray-500 mb-6 text-sm">
           البريد <b>{user.email}</b> مسجل، ولكن لا توجد بيانات وظيفية مرتبطة به.
        </p>
        <button onClick={signOut} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold text-sm">تسجيل خروج</button>
      </div>
    );
  }

  // 3. توجيه ناجح
  return isAdmin ? <AdminDashboard /> : <StaffDashboard employee={employeeProfile} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
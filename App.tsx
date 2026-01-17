import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext'; // <--- استيراد
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';
import { supabase } from './supabaseClient';


import { useEffect } from 'react';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin, signOut } = useAuth();

  // تسجيل الـ Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered', reg.scope))
        .catch(err => console.error('SW Error', err));
    }
  }, []);

  
const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin, signOut } = useAuth();

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
        <p className="text-gray-500 mb-6 text-sm">
           إذا استمرت هذه الشاشة، فهذا يعني أن إيميلك ({user.email}) غير مرتبط بملف موظف.
        </p>
        <button 
            onClick={() => {
                supabase.auth.signOut().then(() => window.location.replace('/'));
            }} 
            className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-gray-900 transition-all text-sm"
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
      {/* تغليف التطبيق بمزود الإشعارات */}
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

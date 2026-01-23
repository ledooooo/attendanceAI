import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';
import { supabase } from './supabaseClient';
import { requestNotificationPermission } from './utils/pushNotifications'; 
// 1. ✅ استيراد Toaster
import { Toaster } from 'react-hot-toast';

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin } = useAuth();

  // 1. تسجيل Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ SW Registered'))
        .catch(err => console.error('❌ SW Failed', err));
    }
  }, []);

  // 2. 🔔 طلب إذن الإشعارات وحفظه
  useEffect(() => {
    if (user?.id) {
      const timer = setTimeout(() => {
        requestNotificationPermission(user.id);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // 3. 🛠️ حل مشكلة التعليق (Timeout)
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        console.warn("⚠️ Loading timeout, resetting...");
        localStorage.clear();
        window.location.reload();
      }, 10000); 
    }
    return () => clearTimeout(timer);
  }, [loading]);


  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-400 text-sm font-bold">جاري استعادة الجلسة...</p>
        <button onClick={() => window.location.reload()} className="mt-8 text-xs text-emerald-600 underline">
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
        
        {/* 2. ✅ إعدادات التنبيهات العامة */}
        <Toaster 
            position="top-center" 
            reverseOrder={false}
            toastOptions={{
                duration: 4000,
                style: {
                    fontFamily: 'inherit', // ليرث الخط العربي من التطبيق
                    borderRadius: '16px',
                    background: '#1f2937', // رمادي غامق
                    color: '#fff',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    zIndex: 99999,
                },
                success: {
                    style: {
                        background: '#10B981', // أخضر (Emerald)
                        color: 'white',
                    },
                    iconTheme: {
                        primary: 'white',
                        secondary: '#10B981',
                    },
                },
                error: {
                    style: {
                        background: '#EF4444', // أحمر
                        color: 'white',
                    },
                    iconTheme: {
                        primary: 'white',
                        secondary: '#EF4444',
                    },
                },
                loading: {
                    style: {
                        background: '#F3F4F6',
                        color: '#374151',
                    },
                }
            }}
        />
      </NotificationProvider>
    </AuthProvider>
  );
}

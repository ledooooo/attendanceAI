import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import LoginPage from './features/auth/LoginPage';
import AdminDashboard from './features/admin/AdminDashboard';
import StaffDashboard from './features/staff/StaffDashboard';

// ✅ 1. استيراد واجهة المشرف الجديدة
import SupervisorDashboard from './features/supervisor/SupervisorDashboard'; 

import { supabase } from './supabaseClient';
import { requestNotificationPermission } from './utils/pushNotifications';
import { Toaster } from 'react-hot-toast';

// 2. استيراد مكتبات React Query والـ Persister
import { QueryClient, useQuery } from '@tanstack/react-query'; // ✅ تأكد من إضافة useQuery هنا
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// 3. استيراد المكونات الإضافية
import OfflineBanner from './components/ui/OfflineBanner';
import OnlineTracker from './components/OnlineTracker';
import MandatoryTrainingGuard from './components/MandatoryTrainingGuard';

// 4. إعداد عميل التخزين والـ Persister
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, 
      gcTime: 1000 * 60 * 60 * 24, 
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: 'offlineFirst' 
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const AppContent = () => {
  const { user, employeeProfile, loading, isAdmin } = useAuth();

  // ✅ استعلام للتحقق مما إذا كان المستخدم يمتلك حساب مشرف (يُنفذ فقط إذا لم يكن موظفاً)
  const { data: supervisorData, isLoading: loadingSup } = useQuery({
      queryKey: ['check_supervisor_status', user?.id],
      queryFn: async () => {
          if (!user?.id) return null;
          const { data } = await supabase
              .from('supervisors')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
          return data;
      },
      // لا نشغل هذا الاستعلام إلا لو كان مسجلاً وليس لديه ملف موظف (لتوفير الموارد)
      enabled: !!user && !employeeProfile 
  });

  // تسجيل Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ SW Registered'))
        .catch(err => console.error('❌ SW Failed', err));
    }
  }, []);

  // طلب إذن الإشعارات
  useEffect(() => {
    if (user?.id) {
      const timer = setTimeout(() => {
        requestNotificationPermission(user.id);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // حل مشكلة التعليق (Timeout)
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


  // شاشة التحميل (أثناء جلب بيانات الموظف أو المشرف)
  if (loading || loadingSup) {
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

  // إذا لم يكن مسجلاً للدخول من الأساس
  if (!user) return <LoginPage />;

  // ==========================================
  // ✅ مسار المشرفين (Supervisors Routing)
  // ==========================================
  if (supervisorData) {
      if (supervisorData.status === 'pending') {
          return (
              <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
                  <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center text-3xl mb-4">⏳</div>
                  <h2 className="text-xl font-black text-gray-800 mb-2">حسابك قيد المراجعة</h2>
                  <p className="text-gray-500 mb-6 text-sm leading-relaxed max-w-sm">
                      مرحباً بك {supervisorData.name}، طلبك حالياً قيد انتظار موافقة إدارة المركز. يرجى المحاولة لاحقاً بعد التواصل مع الإدارة.
                  </p>
                  <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold text-sm">تسجيل خروج</button>
              </div>
          );
      }
      
      if (supervisorData.status === 'rejected') {
          return (
              <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
                  <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mb-4">❌</div>
                  <h2 className="text-xl font-black text-gray-800 mb-2">عذراً، تم رفض الطلب</h2>
                  <p className="text-gray-500 mb-6 text-sm">تم رفض طلب انضمامك بصفة ({supervisorData.role_title}) من قِبل الإدارة.</p>
                  <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold text-sm">تسجيل خروج</button>
              </div>
          );
      }

      // إذا كان معتمداً (approved) يفتح شاشة المشرف
      return (
          <>
            <OnlineTracker />
            <OfflineBanner />
            <SupervisorDashboard />
          </>
      );
  }

  // ==========================================
  // مسار الرفض العام (إذا لم يكن موظفاً ولا مشرفاً)
  // ==========================================
  if (!employeeProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-white" dir="rtl">
        <h2 className="text-xl font-bold text-gray-800 mb-2">حساب غير مصرح به</h2>
        <p className="text-gray-500 mb-6 text-sm">إيميلك ({user.email}) غير مرتبط بملف موظف أو حساب مشرف في النظام.</p>
        <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold text-sm">تسجيل خروج</button>
      </div>
    );
  }

  // ==========================================
  // مسار الموظفين والمديرين العادي (Employees Routing)
  // ==========================================
  return (
    <>
      <OnlineTracker /> 
      <OfflineBanner /> 
      
      {isAdmin ? (
        <AdminDashboard />
      ) : (
        <MandatoryTrainingGuard employeeId={employeeProfile.employee_id}>
            <StaffDashboard employee={employeeProfile} />
        </MandatoryTrainingGuard>
      )}
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <PersistQueryClientProvider 
          client={queryClient} 
          persistOptions={{ persister }}
        >
          
          <AppContent />

          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />

          <Toaster 
            position="top-center" 
            reverseOrder={false}
            toastOptions={{
                duration: 4000,
                style: {
                    fontFamily: 'inherit',
                    borderRadius: '16px',
                    background: '#1f2937',
                    color: '#fff',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    zIndex: 99999,
                },
                success: {
                    style: { background: '#10B981', color: 'white' },
                    iconTheme: { primary: 'white', secondary: '#10B981' },
                },
                error: {
                    style: { background: '#EF4444', color: 'white' },
                    iconTheme: { primary: 'white', secondary: '#EF4444' },
                },
                loading: {
                    style: { background: '#F3F4F6', color: '#374151' },
                }
            }}
          />
        </PersistQueryClientProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Employee } from '../types';

interface AuthContextType {
  user: any | null;
  employeeProfile: Employee | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>; // دالة جديدة لتحديث البيانات يدوياً عند الحاجة
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // دالة مساعدة: جلب ملف الموظف بناءً على الإيميل
  const getProfileData = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching profile:", error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      return null;
    }
  };

  // دالة التهيئة الرئيسية (تعمل مرة واحدة عند فتح الموقع)
  const initializeAuth = async () => {
    setLoading(true);
    try {
      // 1. هل توجد جلسة محفوظة في المتصفح؟
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        // 2. إذا وجدنا مستخدم، نجلب بياناته الوظيفية
        if (session.user.email) {
          const profile = await getProfileData(session.user.email);
          setEmployeeProfile(profile);
        }
      } else {
        // لا يوجد مستخدم
        setUser(null);
        setEmployeeProfile(null);
      }
    } catch (error) {
      console.error("Auth Initialization Error:", error);
      // في حال الخطأ نعتبره خروج لضمان عدم التعليق
      setUser(null);
      setEmployeeProfile(null);
    } finally {
      // 3. إنهاء التحميل في كل الأحوال
      setLoading(false);
    }
  };

  // الاستماع للتغييرات (دخول، خروج، تحديث توكن)
  useEffect(() => {
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth State Changed:", event); // للمراقبة

      if (event === 'SIGNED_IN' && session?.user) {
        // عند تسجيل الدخول، نحدث الحالة
        setUser(session.user);
        const profile = await getProfileData(session.user.email!);
        setEmployeeProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        // عند تسجيل الخروج، نصفر الحالة
        setUser(null);
        setEmployeeProfile(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // عند تحديث التوكن تلقائياً، نتأكد أن المستخدم محدث
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    // لا نحتاج لعمل شيء هنا، الـ listener بالأعلى سيلتقط الحدث SIGNED_IN
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SignOut Error:", error);
    } finally {
      // تنظيف كامل وإجبار المتصفح على التحديث
      setUser(null);
      setEmployeeProfile(null);
      window.location.replace('/');
    }
  };

  const refreshProfile = async () => {
    if (user?.email) {
      const profile = await getProfileData(user.email);
      setEmployeeProfile(profile);
    }
  };

  const isAdmin = employeeProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, employeeProfile, loading, isAdmin, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
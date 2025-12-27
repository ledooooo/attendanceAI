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
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // دالة جلب بيانات الموظف
  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) {
        console.warn("Profile fetch warning:", error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error("Profile fetch error:", err);
      return null;
    }
  };

  // تسجيل الخروج
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SignOut Error:", error);
    } finally {
      setUser(null);
      setEmployeeProfile(null);
      localStorage.clear(); // تنظيف كامل عند الخروج الصريح فقط
      window.location.href = '/'; 
    }
  };

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  useEffect(() => {
    let mounted = true;

    // دالة تهيئة الجلسة عند فتح التطبيق أو عمل Refresh
    const initSession = async () => {
      try {
        // 1. محاولة استعادة الجلسة المخزنة في LocalStorage
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (mounted) {
          if (session?.user) {
            // وجدنا جلسة مخزنة -> نستعيد المستخدم
            setUser(session.user);
            
            // نجلب بيانات الموظف
            if (session.user.email) {
              const profile = await fetchProfile(session.user.email);
              if (mounted) setEmployeeProfile(profile);
            }
          }
        }
      } catch (error) {
        console.error("Session restoration failed:", error);
        // ملاحظة: لا نقوم بعمل signOut هنا لتجنب طرد المستخدم إذا كان الخطأ مؤقتاً
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // الاستماع لأحداث Supabase (مثل تحديث التوكن التلقائي)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log("Auth Event:", event); // للمراقبة في الكونسول

      if (session?.user) {
        setUser(session.user);
        
        // جلب البروفايل فقط إذا لم يكن موجوداً أو تغير المستخدم
        if (!employeeProfile || employeeProfile.email !== session.user.email) {
             const profile = await fetchProfile(session.user.email!);
             if (mounted) setEmployeeProfile(profile);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
      }
      
      // التأكد من إيقاف التحميل في كل الحالات
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = employeeProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, employeeProfile, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
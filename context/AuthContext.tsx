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

  // دالة مساعدة لجلب البيانات (معزولة لتجنب الأخطاء)
  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) console.error("Profile Fetch Error:", error);
      return data;
    } catch {
      return null;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SignOut Error:", error);
    } finally {
      // تنظيف جذري لكل البيانات
      setUser(null);
      setEmployeeProfile(null);
      localStorage.clear();
      sessionStorage.clear();
      // إعادة توجيه قوية لإلغاء أي حالة عالقة
      window.location.replace('/');
    }
  };

  const signIn = async (email: string, pass: string) => {
    // تسجيل الدخول لا يغير حالة loading هنا، نترك الـ Listener يقوم بذلك
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. هل توجد جلسة نشطة؟
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          // 2. وجدنا جلسة -> نجلب بيانات الموظف
          if (mounted) setUser(session.user);
          
          if (session.user.email) {
            const profile = await fetchProfile(session.user.email);
            if (mounted) setEmployeeProfile(profile);
          }
        } else {
          // 3. لا توجد جلسة (خروج أو incognito)
          if (mounted) {
            setUser(null);
            setEmployeeProfile(null);
          }
        }
      } catch (error) {
        console.error("Auth Initialization Failed:", error);
        // في حالة الخطأ، نعتبر المستخدم غير مسجل
        if (mounted) {
          setUser(null);
          setEmployeeProfile(null);
        }
      } finally {
        // 4. أهم خطوة: إيقاف التحميل مهما حدث
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // الاستماع للتغييرات (دخول / خروج)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const profile = await fetchProfile(session.user.email!);
        setEmployeeProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
      }
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
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
  // نبدأ والتحميل مفعل دائماً
  const [loading, setLoading] = useState(true);

  // دالة لجلب بيانات الموظف
  const fetchProfile = async (email: string) => {
    try {
      // نستخدم maybeSingle لتجنب الأخطاء إذا لم يوجد
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching profile:", error);
      }
      return data; // سيعود بـ null إذا لم يوجد، أو البيانات إذا وجدت
    } catch (err) {
      console.error("Profile fetch exception:", err);
      return null;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SignOut Error:", error);
    } finally {
      setUser(null);
      setEmployeeProfile(null);
      localStorage.clear(); // تنظيف كامل
      window.location.href = '/'; 
    }
  };

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        // 1. استرجاع الجلسة من LocalStorage
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted && session?.user) {
          setUser(session.user);
          
          // 2. إذا وجدنا مستخدم، نجلب ملفه الوظيفي فوراً وننتظر النتيجة
          if (session.user.email) {
            const profile = await fetchProfile(session.user.email);
            if (mounted) setEmployeeProfile(profile);
          }
        }
      } catch (error) {
        console.error("Init Session Error:", error);
      } finally {
        // 3. لن نوقف التحميل إلا بعد انتهاء كل شيء
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // الاستماع للتغييرات
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        // عند تسجيل الدخول، لا نوقف التحميل حتى نجلب البيانات
        setLoading(true); 
        setUser(session.user);
        const profile = await fetchProfile(session.user.email!);
        setEmployeeProfile(profile);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
        setLoading(false);
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
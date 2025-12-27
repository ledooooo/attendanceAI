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

  // دالة لجلب ملف الموظف بشكل آمن
  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) {
        console.error("خطأ في جلب الملف الوظيفي:", error);
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  };

  // دالة الخروج المحسنة (تنظيف كامل للذاكرة)
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      // تنظيف كل شيء يدوياً لضمان عدم بقاء أي أثر للجلسة
      setUser(null);
      setEmployeeProfile(null);
      localStorage.clear(); 
      sessionStorage.clear();
      setLoading(false);
      // إعادة تحميل الصفحة بالكامل لإجبار التطبيق على البدء من الصفر
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
        // 1. جلب الجلسة الحالية من الذاكرة
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted && session?.user) {
          setUser(session.user);
          // 2. إذا وجدنا مستخدم، نجلب بيانات الموظف
          if (session.user.email) {
            const profile = await fetchProfile(session.user.email);
            if (mounted) setEmployeeProfile(profile);
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
        if (mounted) signOut(); // إذا حدث خطأ غريب، نخرج المستخدم
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // الاستماع لأي تغيير في حالة الدخول/الخروج
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const profile = await fetchProfile(session.user.email!);
        setEmployeeProfile(profile);
        setLoading(false);
      }
    });

    // --- صمام الأمان (الحل السحري للتعليق) ---
    // إذا ظل التطبيق يحمل لأكثر من 4 ثوانٍ، نوقف التحميل إجبارياً
    const safetyTimeout = setTimeout(() => {
        if (loading) {
            console.warn("تأخر التحميل كثيراً، تم الإيقاف الإجباري.");
            setLoading(false);
        }
    }, 4000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
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
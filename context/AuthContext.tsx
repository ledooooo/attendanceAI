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

  // دالة جلب بيانات الموظف (مفصولة لسهولة الاستدعاء)
  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) {
        console.error("Profile fetch error:", error);
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  };

  // دالة الخروج المحسنة (تنظيف كامل)
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Error signing out:", e);
    } finally {
      setUser(null);
      setEmployeeProfile(null);
      localStorage.clear(); // مسح الذاكرة لضمان عدم بقاء جلسة معلقة
      window.location.href = '/'; // إعادة تحميل الصفحة بالكامل
    }
  };

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        // 1. محاولة جلب الجلسة الحالية
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted && session?.user) {
          setUser(session.user);
          // 2. جلب بيانات الموظف
          if (session.user.email) {
            const profile = await fetchProfile(session.user.email);
            if (mounted) setEmployeeProfile(profile);
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
        // في حال حدوث خطأ كارثي، نقوم بتسجيل الخروج لضمان عدم تعليق التطبيق
        if (mounted) signOut();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // الاستماع للتغييرات (تسجيل دخول/خروج)
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
      } else if (event === 'TOKEN_REFRESHED') {
        // لا نفعل شيئاً عند تحديث التوكن فقط لتجنب إعادة التحميل
      }
    });

    // --- صمام الأمان (Safety Timeout) ---
    // إذا ظل التطبيق يحمل لأكثر من 4 ثوانٍ، نوقف التحميل إجبارياً
    const safetyTimeout = setTimeout(() => {
        if (loading) {
            console.warn("Auth loading timed out, forcing render.");
            setLoading(false);
        }
    }, 4000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  const isAdmin = employeeProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, employeeProfile, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
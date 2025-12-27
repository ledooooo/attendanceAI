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

  // دالة لجلب ملف الموظف باستخدام دالة RPC الآمنة والسريعة
  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_profile');
      
      if (error) {
        console.error("Profile Fetch Error:", error);
        return null;
      }
      // RPC تعيد مصفوفة، نأخذ العنصر الأول
      return data && data.length > 0 ? data[0] : null;
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
      // تنظيف شامل وإعادة تحميل الصفحة
      setUser(null);
      setEmployeeProfile(null);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/'; 
    }
  };

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. استعادة الجلسة
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          if (mounted) setUser(session.user);
          // 2. جلب البروفايل بالدالة السريعة
          const profile = await fetchProfile();
          if (mounted) setEmployeeProfile(profile);
        }
      } catch (error) {
        console.error("Auth Init Error:", error);
      } finally {
        // 3. إنهاء التحميل
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // الاستماع للتغييرات
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const profile = await fetchProfile();
        setEmployeeProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
      }
    });

    // --- مؤقت الأمان (الحل الجذري للتعليق) ---
    // يضمن اختفاء شاشة التحميل بعد 3 ثوانٍ حتى لو تعطلت الشبكة أو قاعدة البيانات
    const safetyTimer = setTimeout(() => {
        if (mounted && loading) {
            console.warn("Safety timer triggered: Forcing loading to stop.");
            setLoading(false);
        }
    }, 3000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
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
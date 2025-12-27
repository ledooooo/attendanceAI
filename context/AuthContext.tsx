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

  // --- دالة جلب البيانات الآمنة (RPC) ---
  const fetchProfile = async () => {
    try {
      // نستخدم الدالة التي أنشأناها في SQL لتجنب مشاكل الصلاحيات
      const { data, error } = await supabase.rpc('get_my_profile');
      
      if (error) {
        console.error("Profile Fetch Error:", error);
        return null;
      }
      
      // الدالة تعيد مصفوفة، نأخذ أول عنصر
      if (data && data.length > 0) {
        return data[0] as Employee;
      }
      return null;
    } catch (err) {
      console.error("Unexpected Error:", err);
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
        // 1. استعادة الجلسة من المتصفح
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          if (mounted) setUser(session.user);
          
          // 2. جلب البروفايل فوراً
          const profile = await fetchProfile();
          if (mounted) setEmployeeProfile(profile);
        }
      } catch (error) {
        console.error("Auth Init Error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // الاستماع للتغييرات (عند الـ Login أو Refresh Token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const profile = await fetchProfile();
        setEmployeeProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // تحديث صامت
        setUser(session.user);
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
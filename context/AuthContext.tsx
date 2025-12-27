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

  // دالة جلب الملف الوظيفي (معزولة للأمان)
  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) console.error("Error fetching profile:", error);
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
    let isMounted = true;

    // 1. الوظيفة الأساسية للتحقق من الجلسة
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (isMounted) {
          if (session?.user) {
            setUser(session.user);
            // إذا وجدنا مستخدم، نجلب بياناته
            if (session.user.email) {
              const profile = await fetchProfile(session.user.email);
              if (isMounted) setEmployeeProfile(profile);
            }
          } else {
            // لا يوجد مستخدم (Incognito أو خروج)
            setUser(null);
            setEmployeeProfile(null);
          }
        }
      } catch (error) {
        console.error("Auth Init Error:", error);
      } finally {
        // أهم سطر: إنهاء التحميل مهما كانت النتيجة
        if (isMounted) setLoading(false);
      }
    };

    // 2. تشغيل الوظيفة
    initSession();

    // 3. الاستماع للتغييرات
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const profile = await fetchProfile(session.user.email!);
        setEmployeeProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
      }
    });

    // 4. (الحل السحري) مؤقت أمان إجباري
    // هذا المؤقت يعمل بشكل مستقل تماماً عن Supabase
    // وظيفته: إذا مر 3 ثواني ومازالت الصفحة تحمل، سيوقف التحميل فوراً
    const forceStopTimer = setTimeout(() => {
        if (isMounted) {
            setLoading((currentLoading) => {
                if (currentLoading) {
                    console.warn("تم إيقاف التحميل إجبارياً بواسطة مؤقت الأمان.");
                    return false;
                }
                return currentLoading;
            });
        }
    }, 3000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(forceStopTimer);
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
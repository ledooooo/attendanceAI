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

  // دالة جلب البيانات باستخدام RPC (لضمان السرعة وتخطي المشاكل)
  const fetchProfile = async (email: string) => {
    try {
      // نستخدم الدالة الآمنة التي أنشأناها في SQL
      // إذا لم تكن قد أنشأت الدالة، سيعود بـ null
      const { data, error } = await supabase.rpc('get_my_profile');
      
      if (error || !data || data.length === 0) {
         // محاولة احتياطية في حال لم تعمل RPC
         const { data: fallbackData } = await supabase
            .from('employees')
            .select('*')
            .eq('email', email)
            .maybeSingle();
         return fallbackData;
      }
      return data[0] as Employee;
    } catch {
      return null;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SignOut Error:", error);
    } finally {
      setUser(null);
      setEmployeeProfile(null);
      localStorage.clear(); // تنظيف كامل
      window.location.replace('/'); // إعادة تحميل لإجبار المتصفح على البدء من جديد
    }
  };

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  useEffect(() => {
    let mounted = true;

    // دالة التعامل مع الجلسة وتحديث الحالة
    const handleSession = async (session: any) => {
      if (session?.user) {
        if (mounted) setUser(session.user);
        
        // جلب البروفايل فقط إذا لم يكن موجوداً
        if (session.user.email) {
            const profile = await fetchProfile(session.user.email);
            if (mounted) setEmployeeProfile(profile);
        }
      } else {
        if (mounted) {
            setUser(null);
            setEmployeeProfile(null);
        }
      }
      if (mounted) setLoading(false);
    };

    // 1. الاستماع المباشر للتغييرات (هذا هو الأهم للتبويبات المتعددة)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event); // للمراقبة

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
        setLoading(false);
      }
    });

    // 2. التحقق المبدئي (للحالات التي لا يطلق فيها المستمع حدثاً فورياً)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSession(session);
      } else {
        // إذا لم نجد جلسة ولم يطلق المستمع حدثاً بعد، ننهي التحميل
        if (mounted && loading) setLoading(false);
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
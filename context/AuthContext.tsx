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

  // دالة لجلب بيانات الموظف
  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle(); // استخدام maybeSingle أفضل لتجنب الأخطاء إذا لم يوجد
      
      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      return data;
    } catch (err) {
      console.error("Profile fetch exception:", err);
      return null;
    }
  };

  const signOut = async () => {
    // تفريغ كل الحالات
    setUser(null);
    setEmployeeProfile(null);
    // مسح الجلسة من Supabase
    await supabase.auth.signOut();
    // مسح الـ LocalStorage يدوياً لضمان عدم بقاء أي بيانات قديمة
    localStorage.clear(); 
    // إعادة التوجيه لصفحة الدخول (اختياري، عادة يتم تلقائياً عند تغيير الحالة)
    window.location.href = '/'; 
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        setLoading(true);
        // 1. جلب الجلسة الحالية
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
           // إذا كان هناك خطأ في الجلسة، نعتبره غير مسجل
           setUser(null);
           setEmployeeProfile(null);
           return; 
        }

        setUser(session.user);

        // 2. إذا وجدنا مستخدم، نحاول جلب ملفه الوظيفي
        if (session.user.email) {
          const profile = await fetchProfile(session.user.email);
          if (profile) {
            setEmployeeProfile(profile);
          } else {
             // هام: إذا دخل المستخدم لكن لم نجد له ملف موظف (حالة نادرة أو خطأ)
             // لا نقوم بتسجيل الخروج فوراً لكي تظهر له رسالة "حساب غير مرتبط"
             setEmployeeProfile(null);
          }
        }

      } catch (err) {
        console.error("Auth init error:", err);
        // في حالة الخطأ الكارثي، نخرج المستخدم
        await signOut();
      } finally {
        // أهم سطر: إيقاف التحميل في كل الأحوال
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        const profile = await fetchProfile(session.user.email!);
        setEmployeeProfile(profile);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
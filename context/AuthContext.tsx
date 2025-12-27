import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Employee } from '../types';

interface AuthContextType {
  user: any | null; 
  employeeProfile: Employee | null; 
  loading: boolean;
  isAdmin: boolean;
  error: string | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (email: string) => {
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (dbError) {
        let msg = dbError.message;
        if (msg.includes('infinite recursion')) {
          msg = "خطأ في سياسات الوصول (RLS): تم اكتشاف تكرار نهائي. يرجى التأكد من أن سياسة الوصول لجدول employees لا تحاول الاستعلام من نفس الجدول بشكل دائري. استخدم (auth.jwt() ->> 'email') مباشرة للمقارنة بدلاً من الاستعلام الفرعي.";
        }
        console.error("Database error fetching profile:", dbError);
        setError(msg);
        setEmployeeProfile(null);
        return;
      }
      
      if (!data) {
        setError(`لم يتم العثور على ملف شخصي مرتبط بهذا البريد: ${email}`);
      }
      
      setEmployeeProfile(data || null);
    } catch (err: any) {
      console.error("Unexpected error fetching profile:", err);
      setError(err?.message || "حدث خطأ غير متوقع أثناء جلب البيانات");
      setEmployeeProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.email) {
      await fetchProfile(user.email);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser?.email) {
        await fetchProfile(currentUser.email);
      }
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser?.email) {
        await fetchProfile(currentUser.email);
      } else {
        setEmployeeProfile(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (signInError) throw signInError;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setEmployeeProfile(null);
    setUser(null);
    setError(null);
  };

  const isAdmin = employeeProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, employeeProfile, loading, isAdmin, error, signIn, signOut, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
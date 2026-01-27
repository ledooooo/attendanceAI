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

  // دالة جلب البيانات باستخدام RPC
  const fetchProfile = async (email: string) => {
    try {
      const { data, error } = await supabase.rpc('get_my_profile');
      
      if (error || !data || data.length === 0) {
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
      localStorage.clear(); 
      window.location.replace('/'); 
    }
  };

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  // 🔥 1. مراقبة التغييرات الحية لطرد الموظف فوراً
  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel('force_logout_channel')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'employees', 
          filter: `email=eq.${user.email}` 
        },
        async (payload) => {
          // إذا تغيرت الحالة إلى موقوف، اطرد المستخدم
          if (payload.new.status === 'موقوف') {
            alert('عذراً، تم إيقاف حسابك من قبل الإدارة.');
            await signOut();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]); // يعتمد على user، سيعمل بمجرد تسجيل الدخول

  // 2. إدارة الجلسة والتحقق المبدئي
  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: any) => {
      if (session?.user) {
        if (mounted) setUser(session.user);
        
        if (session.user.email) {
            const profile = await fetchProfile(session.user.email);
            
            // 🔥 التحقق من الحالة عند فتح التطبيق
            if (profile && profile.status === 'موقوف') {
                await signOut();
                return; // إيقاف التنفيذ
            }

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setEmployeeProfile(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSession(session);
      } else {
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

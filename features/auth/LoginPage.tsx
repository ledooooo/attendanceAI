import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { Lock, Mail, Loader2, UserPlus, LogIn, ArrowRight, UserCheck, Phone, Building2, Briefcase } from 'lucide-react';

const AVATARS = ["👨‍💼", "👩‍💼", "👨‍🔬", "👩‍🔬", "🕵️‍♂️", "🕵️‍♀️", "🧑‍💻", "👩‍💻"];

export default function LoginPage() {
  const { signIn } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'signup_emp' | 'signup_supervisor' | 'recovery'>('signin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supOrg, setSupOrg] = useState('');
  const [supRole, setSupRole] = useState('');
  const [supAvatar, setSupAvatar] = useState(AVATARS[0]);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // دالة الدخول بحساب جوجل للزوار (مبسطة)
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin, // التوجيه للصفحة الرئيسية بعد الدخول
            }
        });
        if (error) throw error;
    } catch (err: any) {
        toast.error('حدث خطأ أثناء الاتصال بخوادم جوجل. يرجى المحاولة لاحقاً.');
        setGoogleLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        toast.success('تم إرسال رابط الاستعادة لبريدك الإلكتروني 📧');
      } 
      else if (mode === 'signup_emp') {
        const { data: exists, error: checkError } = await supabase.rpc('check_is_employee', { 
          email_input: email.trim() 
        });
        if (checkError) throw new Error('خطأ في الاتصال بقاعدة البيانات.');
        if (!exists) throw new Error('هذا البريد غير مسجل لدى الموارد البشرية كـ "موظف". يرجى مراجعة الإدارة.');

        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;

        toast.success('تم تفعيل الحساب! جاري الدخول...');
        await signIn(email, password);
      } 
      else if (mode === 'signup_supervisor') {
        if (supPhone.length !== 11 || !supPhone.startsWith('01')) {
            throw new Error('رقم الموبايل يجب أن يتكون من 11 رقم ويبدأ بـ 01');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
        });
        if (authError) throw authError;

        if (authData.user) {
            const { error: dbError } = await supabase.from('supervisors').insert({
                id: authData.user.id,
                name: supName,
                email: email.trim(),
                phone: supPhone,
                organization: supOrg,
                role_title: supRole,
                avatar_url: supAvatar,
                status: 'pending'
            });

            if (dbError) throw dbError;

            await supabase.from('notifications').insert({
                type: 'new_supervisor',
                title: 'طلب حساب مشرف جديد',
                message: `طلب المشرف ${supName} من جهة ${supOrg} الانضمام للنظام.`,
                to_user: 'admin'
            });

            toast.success('تم تسجيل طلبك بنجاح! يرجى الانتظار لحين موافقة الإدارة.');
            setMode('signin');
            setEmail('');
            setPassword('');
        }
      } 
      else {
        await signIn(email, password);
      }
    } catch (err: any) {
      let msg = err.message;
      if (msg.includes('Invalid login credentials')) msg = 'بيانات الدخول غير صحيحة.';
      if (msg.includes('User already registered')) msg = 'الحساب مفعل بالفعل، قم بتسجيل الدخول.';
      if (msg.includes('Password should be at least')) msg = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans relative overflow-hidden" dir="rtl">
      
      {/* خلفية جمالية */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className={`bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl w-full ${mode === 'signup_supervisor' ? 'max-w-2xl' : 'max-w-md'} border border-white/50 z-10 transition-all duration-500`}>
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-2xl flex items-center justify-center border-2 border-emerald-200 shadow-sm rotate-3 hover:rotate-0 transition-transform">
                <span className="text-4xl">🏥</span>
             </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">مركز غرب المطار</h1>
          <p className="text-emerald-600 font-bold mt-2 text-sm bg-emerald-50 inline-block px-4 py-1 rounded-full border border-emerald-100">
            {mode === 'recovery' ? 'استعادة كلمة المرور' : 
             mode === 'signup_emp' ? 'تفعيل حساب موظف' : 
             mode === 'signup_supervisor' ? 'طلب انضمام مشرف إداري' : 'بوابة الموظفين والزوار'}
          </p>
        </div>

        {/* Tabs Section */}
        {mode !== 'recovery' && mode !== 'signup_supervisor' && (
            <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-8 border border-gray-200/50">
                <button 
                    type="button"
                    onClick={() => { setMode('signin'); setEmail(''); setPassword(''); }} 
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'signin' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    <LogIn className="w-4 h-4"/> دخول الموظفين
                </button>
                <button 
                    type="button"
                    onClick={() => { setMode('signup_emp'); setEmail(''); setPassword(''); }} 
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'signup_emp' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                    <UserPlus className="w-4 h-4"/> تفعيل موظف
                </button>
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          
          <div className={mode === 'signup_supervisor' ? 'grid grid-cols-1 md:grid-cols-2 gap-5' : 'space-y-5'}>
              
              {/* --- حقول المشرف الإضافية --- */}
              {mode === 'signup_supervisor' && (
                  <>
                    <div className="md:col-span-2 mb-2">
                        <label className="block text-xs font-bold text-gray-500 mb-2">اختر صورتك الرمزية</label>
                        <div className="flex gap-2 justify-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                            {AVATARS.map(av => (
                                <button key={av} type="button" onClick={() => setSupAvatar(av)} className={`w-10 h-10 text-2xl rounded-full transition-transform ${supAvatar === av ? 'scale-125 bg-emerald-100 ring-2 ring-emerald-500' : 'hover:scale-110 grayscale-[50%]'}`}>
                                    {av}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">الاسم بالكامل</label>
                        <div className="relative">
                            <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="text" required value={supName} onChange={e => setSupName(e.target.value)} className="w-full pr-12 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700 text-sm transition-all" placeholder="أحمد محمود"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">رقم الموبايل</label>
                        <div className="relative">
                            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="tel" required minLength={11} maxLength={11} value={supPhone} onChange={e => setSupPhone(e.target.value)} className="w-full pr-12 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700 text-sm text-left transition-all" placeholder="01X XXXX XXXX" dir="ltr"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">الجهة التابع لها</label>
                        <div className="relative">
                            <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="text" required value={supOrg} onChange={e => setSupOrg(e.target.value)} className="w-full pr-12 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700 text-sm transition-all" placeholder="الإدارة الصحية..."/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">الصفة الوظيفية</label>
                        <div className="relative">
                            <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="text" required value={supRole} onChange={e => setSupRole(e.target.value)} className="w-full pr-12 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700 text-sm transition-all" placeholder="مفتش مالي وإداري"/>
                        </div>
                    </div>
                  </>
              )}

              {/* Email Field */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="email" required 
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full pr-12 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-bold text-gray-700 text-left text-sm transition-all"
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password Field */}
              {mode !== 'recovery' && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-gray-500">كلمة المرور</label>
                      {mode === 'signin' && (
                          <button 
                            type="button"
                            onClick={() => { setMode('recovery'); setPassword(''); }}
                            className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 transition-colors"
                          >
                            نسيت كلمة المرور؟
                          </button>
                      )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="password" required 
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full pr-12 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-bold text-left text-sm transition-all tracking-widest"
                      placeholder={mode !== 'signin' ? "••••••••" : "••••••••"}
                      minLength={6}
                      dir="ltr"
                    />
                  </div>
                </div>
              )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" disabled={loading}
            className="mt-6 w-full bg-gradient-to-l from-emerald-600 to-teal-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                mode === 'recovery' ? 'إرسال رابط الاستعادة' : 
                mode === 'signup_emp' ? 'تفعيل حساب الموظف' : 
                mode === 'signup_supervisor' ? 'إرسال طلب الانضمام' : 'دخول للنظام'
            )}
          </button>
        </form>

{/* 🌟 قسم الزوار (دخول بجوجل) */}
        {mode === 'signin' && (
            <div className="mt-8">
                {/* 1. الخط الفاصل (تم فصله لتجنب تغطية الزر) */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center pointer-events-none">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="px-4 bg-white text-gray-400 font-black">بوابة المواطنين والزوار</span>
                    </div>
                </div>
                
                {/* 2. زر الدخول بجوجل */}
                <button 
                    type="button"
                    onClick={handleGoogleLogin} 
                    disabled={googleLoading}
                    className="w-full bg-white border-2 border-gray-100 text-gray-700 rounded-2xl py-3.5 text-sm font-black shadow-sm hover:bg-gray-50 hover:border-gray-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 cursor-pointer relative z-10"
                >
                    {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : (
                        <>
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                            تسجيل الدخول بحساب Google
                        </>
                    )}
                </button>
                <p className="text-[10px] text-center text-gray-400 mt-3 font-bold leading-relaxed">
                    الدخول مخصص للزوار للتعرف على مواعيد العيادات، سياسات المركز، والمشاركة بآرائهم ومقترحاتهم.
                </p>
            </div>
        )}

        
        {/* Back/Toggle Buttons */}
        <div className="flex flex-col gap-3 mt-6">
            {(mode === 'recovery' || mode === 'signup_supervisor') && (
                <button 
                  type="button"
                  onClick={() => { setMode('signin'); setEmail(''); setPassword(''); }}
                  className="w-full py-2 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-4 h-4"/> العودة لتسجيل الدخول
                </button>
            )}

            {/* زر إنشاء حساب مشرف جديد يظهر فقط في شاشة الدخول الرئيسية */}
            {mode === 'signin' && (
                <div className="mt-2 pt-4 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400 mb-2 font-bold">هل أنت مفتش أو مشرف من الإدارة؟</p>
                    <button 
                        type="button"
                        onClick={() => { setMode('signup_supervisor'); setEmail(''); setPassword(''); }}
                        className="text-xs font-black text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-4 py-2 rounded-xl"
                    >
                        تسجيل حساب "مشرف إداري"
                    </button>
                </div>
            )}
        </div>

      </div>
      <Toaster />
    </div>
  );
}


import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Lock, Mail, Loader2, UserPlus, LogIn, ArrowRight, UserCheck, Phone, Building2, Briefcase, Image as ImageIcon } from 'lucide-react';

// قائمة افتارات يختار منها المشرف
const AVATARS = [
    "👨‍💼", "👩‍💼", "👨‍🔬", "👩‍🔬", "🕵️‍♂️", "🕵️‍♀️", "🧑‍💻", "👩‍💻"
];

export default function LoginPage() {
  const { signIn } = useAuth();
  
  // الحالات (States) لتحديد وضع الشاشة
  const [mode, setMode] = useState<'signin' | 'signup_emp' | 'signup_supervisor' | 'recovery'>('signin');
  
  // البيانات الأساسية
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // بيانات المشرف الإضافية
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supOrg, setSupOrg] = useState('');
  const [supRole, setSupRole] = useState('');
  const [supAvatar, setSupAvatar] = useState(AVATARS[0]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // ------------------------------------------------
      // 1. حالة استعادة كلمة المرور
      // ------------------------------------------------
      if (mode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage({ text: 'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني، تفقد الرسائل (أو الـ Spam) 📧', type: 'success' });
      } 
      // ------------------------------------------------
      // 2. حالة تفعيل حساب موظف (موجود مسبقاً في HR)
      // ------------------------------------------------
      else if (mode === 'signup_emp') {
        const { data: exists, error: checkError } = await supabase.rpc('check_is_employee', { 
          email_input: email.trim() 
        });
        if (checkError) throw new Error('خطأ في الاتصال بقاعدة البيانات.');
        if (!exists) throw new Error('هذا البريد غير مسجل لدى الموارد البشرية كـ "موظف".');

        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;

        setMessage({ text: 'تم تفعيل الحساب! جاري الدخول...', type: 'success' });
        await signIn(email, password);
      } 
      // ------------------------------------------------
      // 3. حالة إنشاء حساب "مشرف" جديد
      // ------------------------------------------------
      else if (mode === 'signup_supervisor') {
        // تحقق من رقم التليفون
        if (supPhone.length !== 11 || !supPhone.startsWith('01')) {
            throw new Error('رقم الموبايل يجب أن يتكون من 11 رقم ويبدأ بـ 01');
        }

        // أ. إنشاء الحساب في نظام المصادقة
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
        });
        if (authError) throw authError;

        if (authData.user) {
            // ب. إدخال بيانات المشرف في جدول المشرفين وحالته "معلق"
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

            // تنبيه الإدارة عبر جدول الإشعارات (اختياري)
            await supabase.from('notifications').insert({
                type: 'new_supervisor',
                title: 'طلب حساب مشرف جديد',
                message: `طلب المشرف ${supName} من جهة ${supOrg} الانضمام للنظام.`,
                to_user: 'admin' // أو حسب هيكلة الإشعارات لديك
            });

            setMessage({ text: 'تم تسجيل طلبك بنجاح! يرجى الانتظار لحين موافقة الإدارة لتتمكن من الدخول.', type: 'success' });
            // تفريغ الحقول وإعادته لشاشة الدخول
            setMode('signin');
            setEmail('');
            setPassword('');
        }
      }
      // ------------------------------------------------
      // 4. حالة تسجيل الدخول العادي
      // ------------------------------------------------
      else {
        await signIn(email, password);
      }

    } catch (err: any) {
      let msg = err.message;
      if (msg.includes('Invalid login credentials')) msg = 'بيانات الدخول غير صحيحة.';
      if (msg.includes('User already registered')) msg = 'الحساب مفعل بالفعل، قم بتسجيل الدخول.';
      if (msg.includes('Password should be at least')) msg = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans" dir="rtl">
      <div className={`bg-white p-8 rounded-[30px] shadow-xl w-full ${mode === 'signup_supervisor' ? 'max-w-2xl' : 'max-w-md'} border border-gray-100 transition-all duration-500`}>
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border-2 border-emerald-100">
                <span className="text-4xl">🏥</span>
             </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800">مركز غرب المطار</h1>
          <p className="text-gray-400 font-bold mt-2 text-sm">
            {mode === 'recovery' ? 'استعادة كلمة المرور' : 
             mode === 'signup_emp' ? 'تفعيل حساب موظف' : 
             mode === 'signup_supervisor' ? 'طلب انضمام مشرف إداري' : 'تسجيل الدخول للمتابعة'}
          </p>
        </div>

        {/* Tabs Section */}
        {mode !== 'recovery' && mode !== 'signup_supervisor' && (
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button 
                    type="button"
                    onClick={() => { setMode('signin'); setMessage(null); }} 
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'signin' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <LogIn className="w-4 h-4"/> دخول
                </button>
                <button 
                    type="button"
                    onClick={() => { setMode('signup_emp'); setMessage(null); }} 
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'signup_emp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <UserPlus className="w-4 h-4"/> موظف جديد
                </button>
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          
          <div className={mode === 'signup_supervisor' ? 'grid grid-cols-1 md:grid-cols-2 gap-5' : 'space-y-5'}>
              
              {/* --- حقول المشرف الإضافية --- */}
              {mode === 'signup_supervisor' && (
                  <>
                    <div className="md:col-span-2 mb-2">
                        <label className="block text-xs font-bold text-gray-500 mb-2">اختر صورتك الرمزية (الأفاتار)</label>
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
                            <UserCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="text" required value={supName} onChange={e => setSupName(e.target.value)} className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700" placeholder="مثال: أحمد محمود"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">رقم الموبايل (11 رقم)</label>
                        <div className="relative">
                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="tel" required minLength={11} maxLength={11} value={supPhone} onChange={e => setSupPhone(e.target.value)} className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700 text-left" placeholder="01X XXXX XXXX" dir="ltr"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">الجهة التابع لها</label>
                        <div className="relative">
                            <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="text" required value={supOrg} onChange={e => setSupOrg(e.target.value)} className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700" placeholder="مثال: الإدارة الصحية بشمال الجيزة"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">الصفة الوظيفية (الإشرافية)</label>
                        <div className="relative">
                            <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input type="text" required value={supRole} onChange={e => setSupRole(e.target.value)} className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700" placeholder="مثال: مفتش مالي وإداري"/>
                        </div>
                    </div>
                  </>
              )}

              {/* Email Field */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="email" required 
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700 text-left"
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password Field (Hidden in Recovery Mode) */}
              {mode !== 'recovery' && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-gray-500">كلمة المرور</label>
                      {mode === 'signin' && (
                          <button 
                            type="button"
                            onClick={() => { setMode('recovery'); setMessage(null); }}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                          >
                            نسيت كلمة المرور؟
                          </button>
                      )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="password" required 
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-left"
                      placeholder={mode !== 'signin' ? "أنشئ كلمة مرور قوية" : "••••••••"}
                      minLength={6}
                      dir="ltr"
                    />
                  </div>
                </div>
              )}
          </div>

          {/* Error/Success Messages */}
          {message && (
            <div className={`p-3 rounded-xl text-sm font-bold text-center ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {message.text}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" disabled={loading}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 active:scale-95 disabled:bg-gray-400"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
                mode === 'recovery' ? 'إرسال رابط الاستعادة' : 
                mode === 'signup_emp' ? 'تفعيل حساب الموظف' : 
                mode === 'signup_supervisor' ? 'إرسال طلب الانضمام للإدارة' : 'دخول للنظام'
            )}
          </button>

          {/* Back/Toggle Buttons */}
          <div className="flex flex-col gap-2 mt-4">
              {(mode === 'recovery' || mode === 'signup_supervisor') && (
                  <button 
                    type="button"
                    onClick={() => { setMode('signin'); setMessage(null); }}
                    className="w-full py-2 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4"/> العودة لتسجيل الدخول
                  </button>
              )}

              {/* زر إنشاء حساب مشرف جديد يظهر فقط في شاشة الدخول الرئيسية */}
              {mode === 'signin' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                      <p className="text-xs text-gray-400 mb-2 font-bold">لست موظفاً بالمركز؟</p>
                      <button 
                          type="button"
                          onClick={() => { setMode('signup_supervisor'); setMessage(null); setEmail(''); setPassword(''); }}
                          className="text-sm font-black text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-4 py-2 rounded-xl"
                      >
                          تسجيل حساب "مشرف إداري"
                      </button>
                  </div>
              )}
          </div>

        </form>
      </div>
    </div>
  );
}

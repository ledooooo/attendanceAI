import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Lock, Mail, Loader2, UserPlus, LogIn, ArrowRight, UserCheck, Phone, Building2, Briefcase, Image as ImageIcon, HeartPulse } from 'lucide-react';
import toast from 'react-hot-toast';

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

  // بيانات الموظف الإضافية (لشاشة تسجيل الموظف)
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empSpecialty, setEmpSpecialty] = useState('');
  const [empNationalId, setEmpNationalId] = useState('');
  const [empShiftType, setEmpShiftType] = useState('morning');
  const [empAvatar, setEmpAvatar] = useState(AVATARS[0]);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false); // حالة تحميل الدخول بجوجل
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // الدخول يوجه تلقائيا عبر App.tsx
      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage({ text: 'تم إرسال رابط استعادة كلمة المرور لبريدك الإلكتروني.', type: 'success' });
      } else if (mode === 'signup_supervisor') {
        // 1. إنشاء حساب المصادقة للمشرف
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;

        if (authData.user) {
          // 2. إدخال بيانات المشرف في جدول supervisors
          const { error: dbError } = await supabase.from('supervisors').insert({
            id: authData.user.id,
            name: supName,
            email: email,
            phone: supPhone,
            organization: supOrg,
            role_title: supRole,
            avatar_url: supAvatar,
            status: 'active',
            total_points: 0
          });
          
          if (dbError) throw dbError;
          
          setMessage({ text: 'تم إنشاء حساب المشرف بنجاح! جاري تسجيل الدخول...', type: 'success' });
          // إعادة توجيه بعد ثوانٍ أو تسجيل الدخول فوراً
          setTimeout(() => {
              window.location.reload();
          }, 2000);
        }
      } else if (mode === 'signup_emp') {
          // تسجيل الموظف العادي
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
          });
          if (authError) throw authError;
  
          if (authData.user) {
            const { error: dbError } = await supabase.from('employees').insert({
              id: authData.user.id,
              employee_id: empNationalId || authData.user.id.substring(0,8), // كمعرف مؤقت
              name: empName,
              email: email,
              phone: empPhone,
              specialty: empSpecialty,
              shift_type: empShiftType,
              photo_url: empAvatar,
              role: 'staff',
              status: 'active',
              total_points: 0
            });
            
            if (dbError) throw dbError;
            
            setMessage({ text: 'تم إنشاء حساب الموظف بنجاح! جاري تسجيل الدخول...', type: 'success' });
            setTimeout(() => {
                window.location.reload();
            }, 2000);
          }
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'حدث خطأ غير متوقع', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 🌟 دالة تسجيل دخول المرضى بحساب جوجل
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء الاتصال بجوجل');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 font-sans relative overflow-hidden text-right" dir="rtl">
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-[40%] left-[20%] w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl relative z-10 border border-white/40">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-blue-500/30 rotate-3 hover:rotate-0 transition-transform duration-300">
                <img src="/pwa-192x192.png" alt="Logo" className="w-14 h-14 rounded-2xl" />
            </div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                {mode === 'signin' ? 'أهلاً بك' : 
                 mode === 'recovery' ? 'استعادة الحساب' :
                 mode === 'signup_supervisor' ? 'حساب مشرف جديد' :
                 'حساب موظف جديد'}
            </h1>
            <p className="text-sm font-bold text-gray-400 mt-2">
                {mode === 'signin' ? 'سجل دخولك لمتابعة عملك' : 
                 mode === 'recovery' ? 'أدخل بريدك الإلكتروني لاستعادة كلمة المرور' :
                 mode === 'signup_supervisor' ? 'أدخل بياناتك لإنشاء حساب إداري جديد' :
                 'أدخل بياناتك للانضمام لفريق العمل'}
            </p>
          </div>

          {/* Alert Message */}
          {message && (
            <div className={`p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-2 ${
              message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              <div className={`w-2 h-2 rounded-full ${message.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></div>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Common Fields: Email */}
            <div>
              <div className="relative group">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                  placeholder="البريد الإلكتروني"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password Field (Not needed for recovery) */}
            {mode !== 'recovery' && (
              <div>
                <div className="relative group">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-gray-300"
                    placeholder="كلمة المرور"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Supervisor Specific Fields */}
            {mode === 'signup_supervisor' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="relative group">
                        <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="text" required value={supName} onChange={e => setSupName(e.target.value)} placeholder="الاسم رباعي" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <div className="relative group">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="tel" required value={supPhone} onChange={e => setSupPhone(e.target.value)} placeholder="رقم الهاتف" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" dir="ltr" />
                    </div>
                    <div className="relative group">
                        <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="text" value={supOrg} onChange={e => setSupOrg(e.target.value)} placeholder="اسم المركز / المنظمة" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <div className="relative group">
                        <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="text" required value={supRole} onChange={e => setSupRole(e.target.value)} placeholder="المسمى الوظيفي (مثال: مدير المركز)" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" />
                    </div>
                    
                    <div className="pt-2">
                        <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> اختر صورة الملف الشخصي</label>
                        <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
                            {AVATARS.map(avatar => (
                                <button type="button" key={avatar} onClick={() => setSupAvatar(avatar)} className={`w-12 h-12 rounded-xl text-2xl shrink-0 flex items-center justify-center transition-all ${supAvatar === avatar ? 'bg-blue-100 border-2 border-blue-500 scale-110 shadow-md' : 'bg-gray-50 border border-transparent hover:bg-gray-100 grayscale hover:grayscale-0'}`}>
                                    {avatar}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Specific Fields */}
            {mode === 'signup_emp' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="relative group">
                        <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="text" required value={empName} onChange={e => setEmpName(e.target.value)} placeholder="الاسم رباعي" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" />
                    </div>
                    <div className="relative group">
                        <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="text" required value={empNationalId} onChange={e => setEmpNationalId(e.target.value)} placeholder="الرقم القومي / كود الموظف" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" dir="ltr" />
                    </div>
                    <div className="relative group">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="tel" required value={empPhone} onChange={e => setEmpPhone(e.target.value)} placeholder="رقم الهاتف" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" dir="ltr" />
                    </div>
                    <div className="relative group">
                        <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500" />
                        <input type="text" required value={empSpecialty} onChange={e => setEmpSpecialty(e.target.value)} placeholder="التخصص / القسم" className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 pr-12 pl-4 text-sm font-bold focus:border-blue-500 outline-none" />
                    </div>
                    
                    <div className="pt-2">
                        <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> اختر صورة الملف الشخصي</label>
                        <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
                            {AVATARS.map(avatar => (
                                <button type="button" key={avatar} onClick={() => setEmpAvatar(avatar)} className={`w-12 h-12 rounded-xl text-2xl shrink-0 flex items-center justify-center transition-all ${empAvatar === avatar ? 'bg-blue-100 border-2 border-blue-500 scale-110 shadow-md' : 'bg-gray-50 border border-transparent hover:bg-gray-100 grayscale hover:grayscale-0'}`}>
                                    {avatar}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Forgot Password Link */}
            {mode === 'signin' && (
              <div className="flex justify-start">
                <button 
                  type="button" 
                  onClick={() => { setMode('recovery'); setMessage(null); }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
            )}

            {/* Main Action Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl py-4 text-sm font-black shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 
               mode === 'signin' ? <><LogIn className="w-5 h-5" /> تسجيل الدخول</> : 
               mode === 'recovery' ? 'إرسال الرابط' : 
               'إنشاء الحساب'}
            </button>

          </form>

          {/* Back/Toggle Buttons */}
          <div className="flex flex-col gap-2 mt-4">
              {(mode !== 'signin') && (
                  <button 
                    type="button"
                    onClick={() => { setMode('signin'); setMessage(null); }}
                    className="w-full py-2 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4"/> العودة لتسجيل الدخول
                  </button>
              )}

              {/* أزرار إنشاء حساب تظهر فقط في شاشة الدخول الرئيسية */}
              {mode === 'signin' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 text-center flex gap-2">
                      <button 
                          type="button"
                          onClick={() => { setMode('signup_emp'); setMessage(null); setEmail(''); setPassword(''); }}
                          className="flex-1 text-xs font-black text-gray-600 hover:text-gray-800 transition-colors bg-gray-100 hover:bg-gray-200 px-2 py-3 rounded-xl"
                      >
                          تسجيل موظف جديد
                      </button>
                      <button 
                          type="button"
                          onClick={() => { setMode('signup_supervisor'); setMessage(null); setEmail(''); setPassword(''); }}
                          className="flex-1 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2 py-3 rounded-xl"
                      >
                          تسجيل مشرف إداري
                      </button>
                  </div>
              )}
          </div>

{/* 🌟 القسم الجديد: دخول المرضى والمنتفعين (تم تعطيله مؤقتاً لأسباب إدارية)
          {mode === 'signin' && (
              <div className="mt-6 relative">
                  <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-400 font-bold">بوابة المنتفعين والمرضى</span>
                  </div>
                  
                  <button 
                      onClick={handleGoogleLogin} 
                      disabled={googleLoading}
                      className="mt-6 w-full bg-white border-2 border-gray-100 text-gray-700 rounded-2xl py-3.5 text-sm font-black shadow-sm hover:bg-gray-50 hover:border-gray-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                      {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-red-500" /> : (
                          <>
                              <HeartPulse className="w-5 h-5 text-red-500" />
                              دخول المنتفعين بحساب Google
                          </>
                      )}
                  </button>
                  <p className="text-[10px] text-center text-gray-400 mt-3 font-bold">
                      الدخول مخصص للمرضى المسجلين لحجز المواعيد والاستشارات الطبية
                  </p>
              </div>
          )}
          */}
        </div>
    </div>
  );
}


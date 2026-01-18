import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Lock, Mail, Loader2, UserPlus, LogIn, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  
  // الحالات (States)
  const [isSignUp, setIsSignUp] = useState(false); // تبديل بين دخول / تفعيل حساب
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // تبديل لوضع استعادة كلمة المرور
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // ------------------------------------------------
      // 1. حالة استعادة كلمة المرور (نسيت كلمة المرور)
      // ------------------------------------------------
      if (isRecoveryMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin, // سيعود للموقع بعد الضغط على الرابط في الإيميل
        });

        if (error) throw error;

        setMessage({ text: 'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني، تفقد الرسائل (أو الـ Spam) 📧', type: 'success' });
        // لا نقوم بإعادة التوجيه فوراً لنعطي المستخدم وقتاً لقراءة الرسالة
      
      } 
      // ------------------------------------------------
      // 2. حالة تفعيل حساب جديد (Sign Up)
      // ------------------------------------------------
      else if (isSignUp) {
        
        // أ. التحقق من وجود الإيميل في قاعدة البيانات (دالة آمنة)
        const { data: exists, error: checkError } = await supabase.rpc('check_is_employee', { 
          email_input: email.trim() 
        });

        if (checkError) throw new Error('خطأ في الاتصال بقاعدة البيانات.');
        if (!exists) throw new Error('هذا البريد غير مسجل لدى الموارد البشرية.');

        // ب. إنشاء الحساب
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage({ text: 'تم تفعيل الحساب! جاري الدخول...', type: 'success' });
        await signIn(email, password);

      } 
      // ------------------------------------------------
      // 3. حالة تسجيل الدخول العادي (Sign In)
      // ------------------------------------------------
      else {
        await signIn(email, password);
      }

    } catch (err: any) {
      let msg = err.message;
      if (msg.includes('Invalid login credentials')) msg = 'بيانات الدخول غير صحيحة.';
      if (msg.includes('User already registered')) msg = 'الحساب مفعل بالفعل، قم بتسجيل الدخول.';
      if (msg.includes('Password should be at least')) msg = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      if (msg.includes('For security purposes, you can only request')) msg = 'لقد طلبت الاستعادة عدة مرات، الرجاء الانتظار قليلاً.';
      
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans" dir="rtl">
      <div className="bg-white p-8 rounded-[30px] shadow-xl w-full max-w-md border border-gray-100 transition-all duration-300">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border-2 border-emerald-100">
                <span className="text-4xl">🏥</span>
             </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800">مركز غرب المطار</h1>
          <p className="text-gray-400 font-bold mt-2 text-sm">
            {isRecoveryMode 
                ? 'استعادة كلمة المرور' 
                : (isSignUp ? 'تفعيل حساب موظف جديد' : 'تسجيل الدخول للمتابعة')}
          </p>
        </div>

        {/* Tabs Section (Only visible if NOT in recovery mode) */}
        {!isRecoveryMode && (
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button 
                    type="button"
                    onClick={() => { setIsSignUp(false); setMessage(null); }} 
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${!isSignUp ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <LogIn className="w-4 h-4"/> دخول
                </button>
                <button 
                    type="button"
                    onClick={() => { setIsSignUp(true); setMessage(null); }} 
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${isSignUp ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <UserPlus className="w-4 h-4"/> تفعيل حساب
                </button>
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          
          {/* Email Field (Always visible) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="email" required 
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-700"
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* Password Field (Hidden in Recovery Mode) */}
          {!isRecoveryMode && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-gray-500">كلمة المرور</label>
                  {/* Forgot Password Link (Only in Sign In mode) */}
                  {!isSignUp && (
                      <button 
                        type="button"
                        onClick={() => { setIsRecoveryMode(true); setMessage(null); }}
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
                  className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  placeholder={isSignUp ? "أنشئ كلمة مرور" : "••••••••"}
                  minLength={6}
                />
              </div>
            </div>
          )}

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
                isRecoveryMode ? 'إرسال رابط الاستعادة' : (isSignUp ? 'تفعيل الحساب وبدء الاستخدام' : 'دخول للنظام')
            )}
          </button>

          {/* Back Button (Only in Recovery Mode) */}
          {isRecoveryMode && (
              <button 
                type="button"
                onClick={() => { setIsRecoveryMode(false); setMessage(null); }}
                className="w-full py-2 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4"/> العودة لتسجيل الدخول
              </button>
          )}

        </form>
      </div>
    </div>
  );
}

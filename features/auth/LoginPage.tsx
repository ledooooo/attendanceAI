import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Lock, Mail, Loader2, UserPlus, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // --- تفعيل الحساب ---
        
        // 1. التحقق من وجود الإيميل في قاعدة البيانات (دالة آمنة)
        const { data: exists, error: checkError } = await supabase.rpc('check_is_employee', { 
          email_input: email.trim() 
        });

        if (checkError) throw new Error('خطأ في الاتصال بقاعدة البيانات.');
        if (!exists) throw new Error('هذا البريد غير مسجل لدى الموارد البشرية.');

        // 2. إنشاء الحساب
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage({ text: 'تم تفعيل الحساب! جاري الدخول...', type: 'success' });
        await signIn(email, password);

      } else {
        // --- تسجيل الدخول ---
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
      <div className="bg-white p-8 rounded-[30px] shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border-2 border-emerald-100">
                <span className="text-4xl">🏥</span>
             </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800">المركز الطبي الذكي</h1>
          <p className="text-gray-400 font-bold mt-2 text-sm">
            {isSignUp ? 'تفعيل حساب موظف جديد' : 'تسجيل الدخول للمتابعة'}
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button 
                onClick={() => { setIsSignUp(false); setMessage(null); }} 
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${!isSignUp ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <LogIn className="w-4 h-4"/> دخول
            </button>
            <button 
                onClick={() => { setIsSignUp(true); setMessage(null); }} 
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${isSignUp ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <UserPlus className="w-4 h-4"/> تفعيل حساب
            </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="email" required 
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="password" required 
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder={isSignUp ? "أنشئ كلمة مرور" : "••••••••"}
                minLength={6}
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-xl text-sm font-bold text-center ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {message.text}
            </div>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 active:scale-95 disabled:bg-gray-400"
          >
            {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'تفعيل الحساب وبدء الاستخدام' : 'دخول للنظام')}
          </button>
        </form>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Lock, User, Eye, EyeOff, LayoutDashboard } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      alert('فشل تسجيل الدخول: تأكد من البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-xl border border-white p-8 md:p-12 relative overflow-hidden">
        
        {/* خلفية جمالية */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-100 rounded-tr-full -ml-10 -mb-10 opacity-50 pointer-events-none"></div>

        <div className="text-center mb-10 relative z-10">
          {/* الأيقونة هنا */}
          <div className="w-24 h-24 bg-emerald-50 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-emerald-100 border border-emerald-100 transform rotate-3 hover:rotate-0 transition-all duration-500">
            <img 
              src="/pwa-192x192.png" 
              alt="Logo" 
              className="w-20 h-20 rounded-2xl object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                // في حال عدم وجود الصورة، تظهر الأيقونة الافتراضية
                const icon = document.getElementById('fallback-icon');
                if(icon) icon.style.display = 'block';
              }}
            />
            {/* Fallback Icon */}
            <LayoutDashboard id="fallback-icon" className="w-12 h-12 text-emerald-600 hidden" />
          </div>
          
          <h1 className="text-3xl font-black text-gray-800 mb-2">غرب المطار</h1>
          <p className="text-gray-500 font-bold text-sm">نظام إدارة الموارد البشرية الذكي</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 mr-1">البريد الإلكتروني</label>
            <div className="relative">
              <input
                type="email"
                required
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all text-left font-bold text-gray-700"
                placeholder="example@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <User className="w-5 h-5 text-gray-400 absolute right-4 top-4" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 mr-1">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all text-left font-bold text-gray-700"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock className="w-5 h-5 text-gray-400 absolute right-4 top-4" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 top-4 text-gray-400 hover:text-emerald-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "تسجيل الدخول"}
          </button>
        </form>

        <p className="text-center mt-8 text-xs text-gray-400 font-bold">
          © 2024 جميع الحقوق محفوظة لقطاع غرب المطار
        </p>
      </div>
    </div>
  );
}

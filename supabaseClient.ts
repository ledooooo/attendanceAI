import { createClient } from '@supabase/supabase-js';

// 1. محاولة قراءة المتغيرات من ملف .env أو إعدادات Vercel أولاً
// 2. إذا لم تجدها، تستخدم القيم المباشرة (Hardcoded) كبديل لضمان عدم توقف الموقع
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dyrolfnfuaifzguaxtgs.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cm9sZm5mdWFpZnpndWF4dGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NDk0MTEsImV4cCI6MjA4MjAyNTQxMX0.THEBAHRH-2CN4sk6dqG3rB_XkS2_EAahoUc-t6h5lg4';

// تحقق للتأكد من وجود القيم (للمساعدة في التتبع)
if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ خطأ جسيم: رابط Supabase أو المفتاح مفقود!');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage, 
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dyrolfnfuaifzguaxtgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cm9sZm5mdWFpZnpndWF4dGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NDk0MTEsImV4cCI6MjA4MjAyNTQxMX0.THEBAHRH-2CN4sk6dqG3rB_XkS2_EAahoUc-t6h5lg4';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage, // إجبار استخدام الذاكرة المحلية
    autoRefreshToken: true, // تجديد التوكن تلقائياً
    persistSession: true, // الحفاظ على الجلسة
    detectSessionInUrl: true, // اكتشاف الروابط (هام للموبايل والتحويلات)
  },
});
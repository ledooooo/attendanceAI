import { createClient } from '@supabase/supabase-js';

// ⚠️ سنضع الروابط والمفاتيح مباشرة هنا لضمان عملها
// بعد التأكد من عمل الموقع، يمكنك إعادتها لمتغيرات البيئة لاحقاً
const supabaseUrl = 'https://dyrolfnfuaifzguaxtgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cm9sZm5mdWFpZnpndWF4dGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NDk0MTEsImV4cCI6MjA4MjAyNTQxMX0.THEBAHRH-2CN4sk6dqG3rB_XkS2_EAahoUc-t6h5lg4';

// طباعة رسالة في الكونسول للتأكد أن المفتاح تم قراءته (لأغراض التصحيح)
console.log('Supabase Client Initialized:', { 
    url: supabaseUrl, 
    keyLength: supabaseKey?.length 
});

if (!supabaseKey) {
    throw new Error('Supabase Key is MISSING! Please check supabaseClient.ts');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

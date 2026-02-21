// supabase/functions/send-push-notification/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ تعريف الـ Headers بشكل ثابت وموسع
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // 1. ✅ معالجة طلب المصافحة (OPTIONS) فوراً
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. ✅ التصحيح: إزالة Deno.env.get ووضع القيم مباشرة داخل علامات التنصيص
    const supabaseUrl = "https://dyrolfnfuaifzguaxtgs.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cm9sZm5mdWFpZnpndWF4dGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ0OTQxMSwiZXhwIjoyMDgyMDI1NDExfQ.SjrEt5JxFtWhqVNILi5SMMGHiv_lB5kp-fxq3L4oYWQ";
    const publicKey = "BFg7hJozSKJ3nU4lmiKfWPwCMWW3bHHBmK-gcGheDNCXbsjjf4w9hpVhXRI_hUaGzGSx4shYYQJ8mvlbieVmGzc";
    const privateKey = "vioCONZKROzKtlA8k_8ftj8zJAvOODC26Y-fH4g6krc";

    if (!supabaseUrl || !supabaseKey || !publicKey || !privateKey) {
      throw new Error("Server Misconfiguration: Missing Secrets");
    }

    // إعداد الاتصال
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // يمكنك ترك هذا كمتغير بيئة أو كتابته مباشرة أيضاً
    const subject = "mailto:admin@example.com"; 
    
    webpush.setVapidDetails(subject, publicKey, privateKey);

    // 3. قراءة البيانات
    const { userId, title, body, url } = await req.json();

    if (!userId) throw new Error("Missing userId");

    // 4. جلب الاشتراكات
    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (dbError) throw new Error(`DB Error: ${dbError.message}`);

    if (!subscriptions?.length) {
      console.log(`No subscriptions for user ${userId}`);
      return new Response(JSON.stringify({ message: "No devices registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 5. إرسال الإشعارات
    const payload = JSON.stringify({ title, body, url: url || '/' });
    
    const results = await Promise.all(
      subscriptions.map(async (record: any) => {
        try {
          // محاولة إصلاح صيغة الـ JSON إذا كانت نصاً
          let sub = record.subscription_data;
          if (typeof sub === 'string') sub = JSON.parse(sub);
          
          await webpush.sendNotification(sub, payload);
          return { success: true };
        } catch (error: any) {
          console.error("Push Error:", error);
          if (error.statusCode === 410 || error.statusCode === 404) {
            // حذف الاشتراك المنتهي
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', record.id);
          }
          return { success: false, error: error.message };
        }
      })
    );

    return new Response(JSON.stringify({ 
      success: true, 
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Critical Error:", error.message);
    // الرد برسالة خطأ واضحة مع Headers لتجنب خطأ CORS
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500, // Internal Server Error
    });
  }
});

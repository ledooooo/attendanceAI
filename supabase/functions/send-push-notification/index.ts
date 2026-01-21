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
    // 2. ✅ التحقق من المتغيرات قبل الاستخدام (لتجنب الانهيار الصامت)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!supabaseUrl || !supabaseKey || !publicKey || !privateKey) {
      throw new Error("Server Misconfiguration: Missing Secrets");
    }

    // إعداد الاتصال
    const supabase = createClient(supabaseUrl, supabaseKey);
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
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

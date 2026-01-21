import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// إعداد Supabase
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// إعداد Web Push
const vapidKeys = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
};

const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
webpush.setVapidDetails(subject, vapidKeys.publicKey, vapidKeys.privateKey);

// ✅ حل مشكلة CORS (هذا هو الجزء الذي كان يسبب الخطأ)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS", // السماح بـ OPTIONS
};

serve(async (req) => {
  // 1. ✅ معالجة طلب Preflight (OPTIONS)
  // المتصفح يرسل هذا الطلب أولاً للتأكد من أن السيرفر يقبل الاتصال
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, title, body, url } = await req.json();

    if (!userId || !title || !body) {
      throw new Error("Missing required fields: userId, title, or body");
    }

    // 2. جلب اشتراكات المستخدم
    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*') // نجلب كل الأعمدة بما فيها endpoint
      .eq('user_id', userId);

    if (dbError) throw new Error(`Database Error: ${dbError.message}`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. إرسال الإشعارات
    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
    });

    const promises = subscriptions.map((record: any) => {
      // إصلاح: التأكد من صيغة البيانات
      let sub = record.subscription_data;
      if (typeof sub === 'string') {
        try { sub = JSON.parse(sub); } catch (e) {}
      }

      return webpush.sendNotification(sub, payload)
        .catch(async (err: any) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Cleaning up expired subscription for user ${userId}`);
            // حذف الاشتراك التالف باستخدام الـ endpoint المخزن
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              .eq('endpoint', record.endpoint); 
          }
        });
    });

    await Promise.all(promises);

    // 4. ✅ الرد بنجاح (مع إرفاق corsHeaders)
    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    // 5. ✅ الرد بخطأ (مع إرفاق corsHeaders أيضاً)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

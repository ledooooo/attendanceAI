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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // معالجة CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, title, body, url } = await req.json();

    // التحقق من البيانات المطلوبة
    if (!userId || !title || !body) {
      throw new Error("Missing required fields: userId, title, or body");
    }

    // 1. جلب اشتراكات المستخدم من قاعدة البيانات
    // نبحث عن كل الأجهزة المسجلة لهذا المستخدم
    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('subscription_data')
      .eq('user_id', userId);

    if (dbError) {
      throw new Error(`Database Error: ${dbError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No subscriptions found for user: ${userId}`);
      return new Response(JSON.stringify({ message: "User has no push subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. تجهيز محتوى الإشعار
    const payload = JSON.stringify({
      title: title,
      body: body,
      url: url || '/', // الرابط الافتراضي
    });

    // 3. إرسال الإشعارات لكل أجهزة المستخدم
    const promises = subscriptions.map((record: any) => {
      const sub = record.subscription_data; // تأكد أن العمود في الداتابيز بهذا الاسم
      
      return webpush.sendNotification(sub, payload)
        .catch(async (err: any) => {
          // حذف الاشتراك المنتهي
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Subscription expired for user ${userId}, cleaning up...`);
            // حذف الاشتراك التالف من قاعدة البيانات
            // ملاحظة: هنا نحتاج طريقة دقيقة لحذف السطر، يفضل استخدام ID إذا توفر
            // ولكن سنحاول المطابقة ببيانات الاشتراك
             await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              // هذا الشرط يعتمد على دعم Postgres لمطابقة JSON، إذا فشل يمكن الاعتماد على user_id فقط كحل مؤقت
              // أو يفضل أن يكون الجدول يحتوي على عمود id ونخزنه
              .contains('subscription_data', sub); 
          } else {
            console.error("Error sending push:", err);
          }
        });
    });

    await Promise.all(promises);

    return new Response(JSON.stringify({ message: `Sent ${subscriptions.length} notifications` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400, // Bad Request
    });
  }
});

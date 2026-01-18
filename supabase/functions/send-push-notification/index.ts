import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. إعداد الاتصال بقاعدة البيانات (مطلوب لحذف الاشتراكات المنتهية)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { body } = await req.json();
    const { subscriptions, payload } = body;

    if (!subscriptions || !payload) {
      throw new Error("Missing subscriptions or payload");
    }

    // تحويل البيانات لنص
    const notificationPayload = JSON.stringify(payload);

    // إرسال الإشعارات
    const promises = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub, notificationPayload)
        .catch(async (err: any) => {
          // ✅ التحسين: حذف الاشتراك إذا كان غير صالح
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Subscription expired, deleting endpoint: ${sub.endpoint}`);
            
            // حذف السطر من قاعدة البيانات لتنظيف الجدول
            // نفترض أن الجدول يحتوي على عمود subscription_data->>'endpoint'
            // أو يمكننا البحث بمطابقة حقل JSONB كاملاً
            await supabase
              .from('push_subscriptions')
              .delete()
              .contains('subscription_data', { endpoint: sub.endpoint });
              
          } else {
            console.error("Error sending notification:", err);
          }
        })
    );

    await Promise.all(promises);

    return new Response(JSON.stringify({ message: "Sent successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// استيراد المكتبات اللازمة (Deno يتعامل مع الروابط مباشرة)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.3"; // مكتبة الإشعارات
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; // الاتصال بقاعدة البيانات

// إعداد مفاتيح VAPID من البيئة السرية التي أعددناها في المرحلة الثانية
const vapidKeys = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
};

const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

// إعداد المكتبة
webpush.setVapidDetails(subject, vapidKeys.publicKey, vapidKeys.privateKey);

// إعدادات CORS للسماح للمتصفح بالاتصال بالدالة
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. التعامل مع طلبات OPTIONS (ضروري للمتصفح قبل الإرسال الفعلي)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. قراءة البيانات المرسلة من React
    const { body } = await req.json();
    const { subscriptions, payload } = body;

    if (!subscriptions || !payload) {
      throw new Error("Missing subscriptions or payload");
    }

    console.log(`Starting to send notifications to ${subscriptions.length} devices...`);

    // 3. تجهيز محتوى الإشعار كنص JSON
    const notificationPayload = JSON.stringify(payload);

    // 4. إرسال الإشعارات بشكل متوازي (Parallel)
    const promises = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub, notificationPayload)
        .catch((err: any) => {
          // إذا فشل الإرسال لجهاز معين (مثلاً قام المستخدم بإلغاء الاشتراك)
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log("Subscription expired or invalid:", sub.endpoint);
            // هنا يمكن إضافة كود لحذف الاشتراك من قاعدة البيانات لاحقاً
          } else {
            console.error("Error sending notification:", err);
          }
        })
    );

    // انتظار اكتمال جميع عمليات الإرسال
    await Promise.all(promises);

    console.log("Notifications sent successfully!");

    // 5. الرد بنجاح
    return new Response(JSON.stringify({ message: "Sent successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

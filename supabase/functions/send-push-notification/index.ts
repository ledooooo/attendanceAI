import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ✅ 1. إعداد ترويسات CORS للسماح بالوصول من أي مكان (بما في ذلك Vercel)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // ✅ 2. التعامل مع طلب Preflight (OPTIONS)
  // هذا هو الجزء الذي يحل المشكلة التي ظهرت لك
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, title, body, url } = await req.json();

    if (!userId || !title || !body) {
      throw new Error("Missing required fields");
    }

    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (dbError) throw new Error(dbError.message);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const payload = JSON.stringify({ title, body, url: url || '/' });

    const promises = subscriptions.map((record: any) => {
      let sub = record.subscription_data;
      if (typeof sub === 'string') {
        try { sub = JSON.parse(sub); } catch (e) {}
      }

      return webpush.sendNotification(sub, payload)
        .catch(async (err: any) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // حذف الاشتراك المنتهي
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              .eq('endpoint', record.endpoint);
          }
        });
    });

    await Promise.all(promises);

    // ✅ 3. الرد بنجاح مع إرفاق الترويسات
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    // ✅ 4. الرد بخطأ مع إرفاق الترويسات (حتى تظهر تفاصيل الخطأ في المتصفح)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

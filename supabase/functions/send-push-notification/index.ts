import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ صح: أسماء المتغيرات مش قيمها
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@gharbelmatar.com";

    if (!supabaseUrl || !supabaseKey || !publicKey || !privateKey) {
      console.error("Missing env vars:", { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey, hasPub: !!publicKey, hasPriv: !!privateKey });
      throw new Error("Server Misconfiguration: Missing Secrets");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { userId, title, body, url } = await req.json();
    if (!userId) throw new Error("Missing userId");

    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (dbError) throw new Error(`DB Error: ${dbError.message}`);

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ message: "No devices registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const payload = JSON.stringify({ title, body, url: url || '/' });

    const results = await Promise.all(
      subscriptions.map(async (record: any) => {
        try {
          let sub = record.subscription_data;
          if (typeof sub === 'string') sub = JSON.parse(sub);

          await webpush.sendNotification(sub, payload);
          console.log(`✅ Sent to endpoint: ${record.endpoint?.substring(0, 50)}`);
          return { success: true };
        } catch (error: any) {
          console.error("Push Error:", error.statusCode, error.message);
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', record.id);
            console.log(`🗑️ Deleted expired subscription: ${record.id}`);
          }
          return { success: false, error: error.message };
        }
      })
    );

    return new Response(JSON.stringify({
      success: true,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Critical Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

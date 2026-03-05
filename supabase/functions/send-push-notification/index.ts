// supabase/functions/send-push-notification/index.ts

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
    const supabaseUrl = "https://dyrolfnfuaifzguaxtgs.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cm9sZm5mdWFpZnpndWF4dGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ0OTQxMSwiZXhwIjoyMDgyMDI1NDExfQ.SjrEt5JxFtWhqVNILi5SMMGHiv_lB5kp-fxq3L4oYWQ";
    const publicKey = "BIkRpd6ma443zGKy3FqGVxXMT4JyARFx36pcc-NAYVdPiB1WTEw9m6XKJq4OXO70Vnyh0zYnE_NkjK3p3VZIINw";
    const privateKey = "ZQJS87_IIuB1Uwg85yclChBtgPrWsrdm6-AIAW53l6U";

    // ✅ ضع دومين موقعك الحقيقي هنا بدل example.com
    const subject = "https://gharb-alpha.vercel.app";

    if (!supabaseUrl || !supabaseKey || !publicKey || !privateKey) {
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
      console.log(`No subscriptions for user ${userId}`);
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
          return { success: true };
        } catch (error: any) {
          console.error("Push Error:", error);
          if (error.statusCode === 410 || error.statusCode === 404) {
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

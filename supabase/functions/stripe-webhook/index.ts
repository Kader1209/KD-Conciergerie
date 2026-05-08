import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const checkoutTable = Deno.env.get("SUPABASE_CHECKOUT_TABLE") ?? "stripe_checkout_sessions";

    if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuration webhook manquante" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSignature = req.headers.get("stripe-signature");
    if (!stripeSignature) {
      return new Response(JSON.stringify({ error: "Signature Stripe absente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.text();
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const event = await stripe.webhooks.constructEventAsync(payload, stripeSignature, stripeWebhookSecret);

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabase
        .from(checkoutTable)
        .update({
          payment_status: session.payment_status || "paid",
          session_status: session.status || "complete",
        })
        .eq("stripe_session_id", session.id);
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabase
        .from(checkoutTable)
        .update({ session_status: "expired" })
        .eq("stripe_session_id", session.id);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabase
        .from(checkoutTable)
        .update({
          payment_status: "failed",
          session_status: session.status || "complete",
        })
        .eq("stripe_session_id", session.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne webhook" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

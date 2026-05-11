import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const checkoutTable = Deno.env.get("SUPABASE_CHECKOUT_TABLE") ?? "stripe_checkout_sessions";

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuration serveur manquante (Stripe/Supabase)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const amount = Number(body?.amount);
    const description = String(body?.description || "Réservation KD Conciergerie").trim();
    const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : null;
    const customerPhone = body?.customerPhone ? String(body.customerPhone).trim() : null;
    const guestFirstName = body?.guestFirstName ? String(body.guestFirstName).trim() : null;
    const propertyTitle = body?.propertyTitle ? String(body.propertyTitle).trim() : null;
    const staySummary = body?.staySummary ? String(body.staySummary).trim() : null;
    const bookingId = body?.bookingId ? String(body.bookingId).trim() : null;

    if (!Number.isFinite(amount) || amount < 1) {
      return new Response(JSON.stringify({ error: "Montant invalide ou manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unitAmount = Math.round(amount * 100);
    const metaVal = (v: string | null | undefined, max = 450) => {
      const s = (v ?? "").trim();
      return s.length > max ? s.slice(0, max) : s;
    };
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      phone_number_collection: { enabled: true },
      metadata: {
        booking_id: metaVal(bookingId),
        guest_first_name: metaVal(guestFirstName),
        property_title: metaVal(propertyTitle),
        stay_summary: metaVal(staySummary),
        backup_phone: metaVal(customerPhone, 40),
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: description },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: "https://kader1209.github.io/KD-Conciergerie/paiement-valide.html",
      cancel_url: "https://kader1209.github.io/KD-Conciergerie/paiement-refuse.html",
    });

    await supabase.from(checkoutTable).insert({
      stripe_session_id: session.id,
      amount_eur: amount,
      amount_cents: unitAmount,
      currency: "eur",
      description,
      payment_status: session.payment_status || "unpaid",
      session_status: session.status || "open",
      checkout_url: session.url,
      customer_email: customerEmail,
      booking_id: bookingId,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

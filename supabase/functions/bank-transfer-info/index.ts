import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendBookingWelcome } from "../_shared/send-notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coordonnées bancaires factices pour l'environnement de TEST.
// IMPORTANT : remplacer côté Supabase par les vraies coordonnées via les
// variables d'environnement (Project Settings → Edge Functions → Secrets) :
//   BANK_TRANSFER_BENEFICIARY, BANK_TRANSFER_IBAN, BANK_TRANSFER_BIC,
//   BANK_TRANSFER_BANK_NAME, BANK_TRANSFER_REFERENCE_PREFIX,
//   BANK_TRANSFER_MODE=live
// Tant que BANK_TRANSFER_MODE n'est pas explicitement à "live", la fonction
// renvoie ces valeurs de test et le champ JSON `mode` vaut "test".
const TEST_BANK_DEFAULTS = {
  beneficiary: "KD CONCIERGERIE (TEST)",
  iban: "FR76 0000 0000 0000 0000 0000 000",
  bic: "TESTFRP1XXX",
  bankName: "Banque de Test KD",
  bankAddress: "1 rue de la Démonstration, 75000 Paris (TEST)",
  referencePrefix: "KD-TEST",
};

const sanitizeText = (value: unknown, fallback: string) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : fallback;
};

const formatReference = (prefix: string, bookingId: string | null) => {
  const safePrefix = prefix.replace(/\s+/g, "-").toUpperCase();
  if (bookingId) {
    return `${safePrefix}-${bookingId.replace(/\s+/g, "").toUpperCase()}`;
  }
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 12);
  return `${safePrefix}-${stamp}`;
};

const formatAmountEur = (amount: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const mode = (Deno.env.get("BANK_TRANSFER_MODE") || "test").toLowerCase() === "live" ? "live" : "test";

    const beneficiary = sanitizeText(Deno.env.get("BANK_TRANSFER_BENEFICIARY"), TEST_BANK_DEFAULTS.beneficiary);
    const iban = sanitizeText(Deno.env.get("BANK_TRANSFER_IBAN"), TEST_BANK_DEFAULTS.iban);
    const bic = sanitizeText(Deno.env.get("BANK_TRANSFER_BIC"), TEST_BANK_DEFAULTS.bic);
    const bankName = sanitizeText(Deno.env.get("BANK_TRANSFER_BANK_NAME"), TEST_BANK_DEFAULTS.bankName);
    const bankAddress = sanitizeText(Deno.env.get("BANK_TRANSFER_BANK_ADDRESS"), TEST_BANK_DEFAULTS.bankAddress);
    const referencePrefix = sanitizeText(
      Deno.env.get("BANK_TRANSFER_REFERENCE_PREFIX"),
      TEST_BANK_DEFAULTS.referencePrefix
    );
    const supportEmail = sanitizeText(Deno.env.get("BANK_TRANSFER_SUPPORT_EMAIL"), "contact@kd-conciergerie.example");

    let bookingId: string | null = null;
    let amountEur: number | null = null;
    let description = "Réservation KD Conciergerie";
    let customerEmail: string | null = null;
    let customerPhone: string | null = null;
    let guestFirstName: string | null = null;
    let propertyTitle: string | null = null;
    let staySummary: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        bookingId = body?.bookingId ? String(body.bookingId).trim() : null;
        const rawAmount = Number(body?.amount);
        if (Number.isFinite(rawAmount) && rawAmount > 0) {
          amountEur = Math.round(rawAmount * 100) / 100;
        }
        if (typeof body?.description === "string" && body.description.trim()) {
          description = body.description.trim();
        }
        if (typeof body?.customerEmail === "string" && body.customerEmail.trim()) {
          customerEmail = body.customerEmail.trim();
        }
        if (typeof body?.customerPhone === "string" && body.customerPhone.trim()) {
          customerPhone = body.customerPhone.trim();
        }
        if (typeof body?.guestFirstName === "string" && body.guestFirstName.trim()) {
          guestFirstName = body.guestFirstName.trim();
        }
        if (typeof body?.propertyTitle === "string" && body.propertyTitle.trim()) {
          propertyTitle = body.propertyTitle.trim();
        }
        if (typeof body?.staySummary === "string" && body.staySummary.trim()) {
          staySummary = body.staySummary.trim();
        }
      } catch {
        // Body JSON optionnel : on continue avec les valeurs par défaut.
      }
    }

    const reference = formatReference(referencePrefix, bookingId);
    const currency = "EUR";

    // Journalisation optionnelle si Supabase est configuré et qu'une table dédiée existe.
    // La table est facultative : l'absence (ou une erreur d'écriture) ne casse pas la réponse.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const transferTable = Deno.env.get("SUPABASE_BANK_TRANSFER_TABLE") || "bank_transfer_requests";
    if (supabaseUrl && supabaseServiceRoleKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await supabase.from(transferTable).insert({
          reference,
          booking_id: bookingId,
          amount_eur: amountEur,
          currency,
          description,
          customer_email: customerEmail,
          mode,
        });
      } catch {
        // Pas de table ? On ignore silencieusement, ce n'est pas bloquant pour le client.
      }
    }

    const responseBody = {
      mode,
      currency,
      amount: amountEur,
      amountFormatted: amountEur != null ? formatAmountEur(amountEur) : null,
      description,
      reference,
      bookingId,
      bank: {
        beneficiary,
        iban,
        bic,
        name: bankName,
        address: bankAddress,
      },
      instructions: [
        "Effectuez le virement depuis votre application bancaire en utilisant les coordonnées ci-dessous.",
        "Indiquez impérativement la référence dans le libellé pour que nous puissions identifier votre paiement.",
        "Votre réservation sera confirmée dès réception du virement (24 à 72h ouvrées).",
      ],
      support: {
        email: supportEmail,
      },
      notice:
        mode === "test"
          ? "Coordonnées de test — n'effectuez aucun virement réel. Configurez les variables d'environnement BANK_TRANSFER_* puis BANK_TRANSFER_MODE=live pour passer en production."
          : null,
    };

    if ((customerEmail || customerPhone) && amountEur != null && amountEur > 0) {
      await sendBookingWelcome({
        email: customerEmail,
        phone: customerPhone,
        guestFirstName,
        propertyTitle,
        staySummary,
        amountFormatted: responseBody.amountFormatted,
      });
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne bank-transfer" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

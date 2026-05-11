import { buildWelcomeEmailHtml, buildWelcomeSmsText, welcomeEmailSubject, type WelcomeContext } from "./booking-welcome.ts";

export type SendWelcomeInput = WelcomeContext & {
  email?: string | null;
  phone?: string | null;
};

/** Normalise un numéro français vers E.164 (+33…) pour Twilio. */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).trim().replace(/[\s().-]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) return d.length >= 10 ? d : null;
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("0")) d = "+33" + d.slice(1);
  else if (!d.startsWith("+")) d = "+33" + d;
  return /^\+[1-9]\d{8,14}$/.test(d) ? d : null;
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("RESEND_FROM_EMAIL")?.trim();
  if (!apiKey || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return res.ok;
}

async function sendTwilioSms(toE164: string, body: string): Promise<boolean> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  const from = Deno.env.get("TWILIO_FROM_NUMBER")?.trim();
  if (!sid || !token || !from) return false;
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: toE164, From: from, Body: body }).toString(),
  });
  return res.ok;
}

/** Envoie l’accueil e-mail + SMS si les clés API sont configurées (sinon no-op). */
export async function sendBookingWelcome(input: SendWelcomeInput): Promise<void> {
  const ctx: WelcomeContext = {
    guestFirstName: input.guestFirstName,
    propertyTitle: input.propertyTitle,
    staySummary: input.staySummary,
    amountFormatted: input.amountFormatted,
  };
  const email = input.email?.trim();
  const phoneE164 = normalizePhoneE164(input.phone ?? null);

  if (email) {
    try {
      await sendResendEmail(email, welcomeEmailSubject(), buildWelcomeEmailHtml(ctx));
    } catch {
      // ne pas faire échouer le webhook
    }
  }
  if (phoneE164) {
    try {
      await sendTwilioSms(phoneE164, buildWelcomeSmsText(ctx));
    } catch {
      //
    }
  }
}

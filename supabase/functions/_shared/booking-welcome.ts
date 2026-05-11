export type WelcomeContext = {
  guestFirstName?: string | null;
  propertyTitle?: string | null;
  staySummary?: string | null;
  amountFormatted?: string | null;
};

const hostLabel = () => Deno.env.get("KD_HOST_LABEL")?.trim() || "votre hôte";

export const welcomeEmailSubject = () => "KD Conciergerie — confirmation et informations pour votre séjour";

export function buildWelcomeEmailHtml(ctx: WelcomeContext): string {
  const name = ctx.guestFirstName?.trim();
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,";
  const property = ctx.propertyTitle?.trim()
    ? `<p><strong>Logement :</strong> ${escapeHtml(ctx.propertyTitle.trim())}</p>`
    : "";
  const stay = ctx.staySummary?.trim()
    ? `<p><strong>Séjour :</strong> ${escapeHtml(ctx.staySummary.trim())}</p>`
    : "";
  const amount = ctx.amountFormatted?.trim()
    ? `<p><strong>Montant :</strong> ${escapeHtml(ctx.amountFormatted.trim())}</p>`
    : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/></head><body style="font-family:Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#222;">
<p>${greeting}</p>
<p>Nous vous remercions pour votre réservation auprès de <strong>KD Conciergerie</strong>.</p>
${property}${stay}${amount}
<h2 style="font-size:1.05rem;margin:1.25rem 0 0.5rem;">Remise des clés</h2>
<p>La récupération du logement s’effectue <strong>entre 15h et 18h</strong> (sauf accord écrit différent).</p>
<h2 style="font-size:1.05rem;margin:1.25rem 0 0.5rem;">Règlement intérieur — obligations strictes</h2>
<ul>
<li><strong>Départ impératif :</strong> le bien doit être libéré au plus tard à <strong>12h</strong> le jour de départ.</li>
<li><strong>État du logement :</strong> veillez à ne pas abîmer les intérieurs, murs, sols, équipements et mobilier. Tout dégât pourra être refacturé.</li>
<li><strong>Vol ou disparition d’objets :</strong> tout vol ou détournement de biens appartenant au logement pourra entraîner des poursuites et la <strong>retenue totale ou partielle de la caution</strong>, sans préjudice d’autres recours.</li>
</ul>
<p>Nous vous souhaitons un excellent séjour.</p>
<p><strong>${escapeHtml(hostLabel())}</strong> reste joignable pour toute demande ou question complémentaire — répondez simplement à cet e-mail ou utilisez le canal de contact habituel.</p>
<p style="color:#666;font-size:0.9rem;margin-top:2rem;">KD Conciergerie</p>
</body></html>`;
}

export function buildWelcomeSmsText(ctx: WelcomeContext): string {
  const name = ctx.guestFirstName?.trim();
  const hi = name ? `Bonjour ${name}, ` : "Bonjour, ";
  const prop = ctx.propertyTitle?.trim() ? `Logement : ${ctx.propertyTitle.trim()}. ` : "";
  return (
    `${hi}merci pour votre réservation KD Conciergerie. ${prop}` +
    `Remise des clés : 15h-18h. Départ impératif avant 12h. ` +
    `Ne pas abîmer le logement ni le mobilier. Vol = retenue de caution possible. ` +
    `Bon séjour — ${hostLabel()} reste disponible pour vos questions.`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

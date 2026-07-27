/**
 * Email « points de fidélité ajustés » — envoyé au client quand le pro
 * ajoute/retire des points depuis sa fiche client (fidélité v2).
 * Trilingue (locale mémorisée sur ProviderClient.clientLocale).
 */

import { resend, emailConfig, getEmailWrapperHtml } from '@/lib/resend';

type Locale = 'fr' | 'en' | 'it' | 'pt';
const resolveLocale = (raw: string | null | undefined): Locale =>
  raw === 'en' || raw === 'it' || raw === 'pt' ? raw : 'fr';

const REASON_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    geste_commercial: 'Geste commercial',
    compensation_retard: 'Compensation pour un retard',
    parrainage: 'Parrainage',
    evenement: 'Événement spécial',
    erreur_correction: "Correction d'une erreur",
    autre: 'Attention particulière',
  },
  en: {
    geste_commercial: 'Goodwill gesture',
    compensation_retard: 'Compensation for a delay',
    parrainage: 'Referral',
    evenement: 'Special event',
    erreur_correction: 'Error correction',
    autre: 'Special attention',
  },
  it: {
    geste_commercial: 'Gesto commerciale',
    compensation_retard: 'Compenso per un ritardo',
    parrainage: 'Passaparola',
    evenement: 'Evento speciale',
    erreur_correction: 'Correzione di un errore',
    autre: 'Attenzione speciale',
  },
  pt: {
    geste_commercial: 'Gesto comercial',
    compensation_retard: 'Compensação por um atraso',
    parrainage: 'Recomendação',
    evenement: 'Evento especial',
    erreur_correction: 'Correção de um erro',
    autre: 'Atenção especial',
  },
};

const TEXTS = {
  fr: {
    subjectAdd: (p: string) => `${p} a ajouté des points à votre carte de fidélité`,
    subjectRemove: (p: string) => `Votre carte de fidélité chez ${p} a été mise à jour`,
    hello: (n: string) => `Bonjour ${n},`,
    added: (d: number, p: string) => `Bonne nouvelle ! <strong>${p}</strong> vient d'ajouter <strong>${d} point${d > 1 ? 's' : ''}</strong> à votre carte de fidélité.`,
    removed: (d: number, p: string) => `<strong>${p}</strong> a mis à jour votre carte de fidélité (${d} point${d < -1 ? 's' : ''}).`,
    yourCard: 'Votre carte',
    progress: (c: number, t: number) => `${c} / ${t} rendez-vous`,
    armed: 'Votre récompense est prête ! Elle sera appliquée automatiquement à votre prochaine réservation éligible.',
    remaining: (r: number) => `Plus que ${r} rendez-vous avant votre récompense.`,
    openApp: "Voir ma carte dans l'app",
    signoff: 'À très vite,',
  },
  en: {
    subjectAdd: (p: string) => `${p} added points to your loyalty card`,
    subjectRemove: (p: string) => `Your loyalty card at ${p} was updated`,
    hello: (n: string) => `Hi ${n},`,
    added: (d: number, p: string) => `Good news! <strong>${p}</strong> just added <strong>${d} point${d > 1 ? 's' : ''}</strong> to your loyalty card.`,
    removed: (d: number, p: string) => `<strong>${p}</strong> updated your loyalty card (${d} point${d < -1 ? 's' : ''}).`,
    yourCard: 'Your card',
    progress: (c: number, t: number) => `${c} / ${t} appointments`,
    armed: 'Your reward is ready! It will be applied automatically to your next eligible booking.',
    remaining: (r: number) => `Only ${r} appointment${r > 1 ? 's' : ''} left before your reward.`,
    openApp: 'View my card in the app',
    signoff: 'See you soon,',
  },
  it: {
    subjectAdd: (p: string) => `${p} ha aggiunto punti alla tua carta fedeltà`,
    subjectRemove: (p: string) => `La tua carta fedeltà da ${p} è stata aggiornata`,
    hello: (n: string) => `Ciao ${n},`,
    added: (d: number, p: string) => `Buone notizie! <strong>${p}</strong> ha appena aggiunto <strong>${d} punt${d > 1 ? 'i' : 'o'}</strong> alla tua carta fedeltà.`,
    removed: (d: number, p: string) => `<strong>${p}</strong> ha aggiornato la tua carta fedeltà (${d} punt${d < -1 ? 'i' : 'o'}).`,
    yourCard: 'La tua carta',
    progress: (c: number, t: number) => `${c} / ${t} appuntamenti`,
    armed: 'La tua ricompensa è pronta! Sarà applicata automaticamente alla prossima prenotazione idonea.',
    remaining: (r: number) => `Ancora ${r} appuntament${r > 1 ? 'i' : 'o'} prima della tua ricompensa.`,
    openApp: "Vedi la mia carta nell'app",
    signoff: 'A prestissimo,',
  },
  pt: {
    subjectAdd: (p: string) => `${p} adicionou pontos ao seu cartão de fidelização`,
    subjectRemove: (p: string) => `O seu cartão de fidelização em ${p} foi atualizado`,
    hello: (n: string) => `Olá ${n},`,
    added: (d: number, p: string) => `Boas notícias! <strong>${p}</strong> acabou de adicionar <strong>${d} ponto${d > 1 ? 's' : ''}</strong> ao seu cartão de fidelização.`,
    removed: (d: number, p: string) => `<strong>${p}</strong> atualizou o seu cartão de fidelização (${d} ponto${d < -1 ? 's' : ''}).`,
    yourCard: 'O seu cartão',
    progress: (c: number, t: number) => `${c} / ${t} marcações`,
    armed: 'A sua recompensa está pronta! Será aplicada automaticamente na sua próxima marcação elegível.',
    remaining: (r: number) => `${r > 1 ? `Faltam apenas ${r} marcações` : 'Falta apenas 1 marcação'} para a sua recompensa.`,
    openApp: 'Ver o meu cartão na app',
    signoff: 'Até breve,',
  },
} as const;

export interface LoyaltyAdjustmentEmailParams {
  to: string;
  clientName: string;
  providerName: string;
  delta: number;
  reason: string;
  note: string | null;
  /** Compte effectif APRÈS ajustement (calculé + delta, plancher 0). */
  newCount: number;
  threshold: number;
  locale?: string | null;
}

/** Rangée de tampons ●○ — même langage visuel que l'email de confirmation. */
function stampsRow(count: number, threshold: number): string {
  const inCycle = count >= threshold && count % threshold === 0 ? threshold : count % threshold;
  return Array.from({ length: threshold }, (_, i) =>
    `<span style="font-size:20px;color:${i < inCycle ? '#1a6daf' : '#d1d5db'};margin-right:4px;">${i < inCycle ? '●' : '○'}</span>`,
  ).join('');
}

/** Corps HTML de l'email — exporté pour l'aperçu /dev/loyalty-v2-preview. */
export function buildLoyaltyAdjustmentEmailBody(params: LoyaltyAdjustmentEmailParams): { subject: string; body: string } {
  const l = resolveLocale(params.locale);
  const t = TEXTS[l];
  const { delta, newCount, threshold, providerName } = params;
  const armed = newCount >= threshold && newCount % threshold === 0;
  const reasonLabel = params.reason === 'autre' && params.note
    ? params.note
    : REASON_LABELS[l][params.reason] ?? REASON_LABELS[l].autre;

  const body = `
    <p style="font-size:16px;color:#111827;">${t.hello(params.clientName)}</p>
    <p style="font-size:15px;color:#374151;line-height:1.6;">
      ${delta > 0 ? t.added(delta, providerName) : t.removed(delta, providerName)}
    </p>
    <p style="font-size:14px;color:#6b7280;">${reasonLabel}${params.reason !== 'autre' && params.note ? ` — ${params.note}` : ''}</p>
    <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
      <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#1a6daf;margin:0 0 10px;">${t.yourCard}</p>
      <div style="margin-bottom:8px;">${stampsRow(newCount, threshold)}</div>
      <p style="font-size:15px;font-weight:600;color:#111827;margin:0;">${t.progress(Math.min(newCount, threshold), threshold)}</p>
      <p style="font-size:14px;color:${armed ? '#059669' : '#6b7280'};margin:8px 0 0;">
        ${armed ? `<strong>${t.armed}</strong>` : t.remaining(threshold - (newCount % threshold))}
      </p>
    </div>
    <p style="font-size:15px;color:#374151;">${t.signoff}<br/>${providerName}</p>
  `;

  return { subject: delta > 0 ? t.subjectAdd(providerName) : t.subjectRemove(providerName), body };
}

export async function sendLoyaltyAdjustmentEmail(
  params: LoyaltyAdjustmentEmailParams,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[loyaltyAdjustment] RESEND_API_KEY not set — email skipped');
    return;
  }
  const { subject, body } = buildLoyaltyAdjustmentEmailBody(params);
  await resend.emails.send({
    from: emailConfig.from,
    to: params.to,
    subject,
    html: getEmailWrapperHtml(body),
  });
}

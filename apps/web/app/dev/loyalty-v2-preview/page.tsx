/**
 * /dev/loyalty-v2-preview — aperçu TEMPORAIRE fidélité v2 (fausses données).
 * Rend les VRAIS templates d'emails (code identique à la prod) dans le
 * wrapper email réel. À supprimer une fois la feature validée.
 */

import { buildLoyaltyAdjustmentEmailBody } from '@/lib/emails/loyaltyAdjustment';
import { getEmailWrapperHtml } from '@/lib/resend';

export const dynamic = 'force-dynamic';

const CASES = [
  {
    label: 'Ajout de points — geste commercial (4/6 → 5/6)',
    params: {
      to: 'lea@example.com', clientName: 'Léa', providerName: 'Salon de Coiffure',
      delta: 1, reason: 'geste_commercial', note: null, newCount: 5, threshold: 6, locale: 'fr',
    },
  },
  {
    label: 'Ajout — récompense débloquée (6/6, motif libre « autre »)',
    params: {
      to: 'hugo@example.com', clientName: 'Hugo', providerName: 'Salon de Coiffure',
      delta: 2, reason: 'autre', note: 'Merci pour votre patience pendant les travaux !',
      newCount: 6, threshold: 6, locale: 'fr',
    },
  },
  {
    label: 'Retrait de points — correction (3/6 → 2/6)',
    params: {
      to: 'emma@example.com', clientName: 'Emma', providerName: 'Salon de Coiffure',
      delta: -1, reason: 'erreur_correction', note: null, newCount: 2, threshold: 6, locale: 'fr',
    },
  },
] as const;

export default function LoyaltyV2PreviewPage() {
  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        Fidélité v2 — aperçu des emails d&apos;ajustement (données fictives)
      </h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        Templates réels (buildLoyaltyAdjustmentEmailBody + wrapper email prod). Page temporaire.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {CASES.map((c) => {
          const { subject, body } = buildLoyaltyAdjustmentEmailBody({ ...c.params });
          return (
            <div key={c.label}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{c.label}</p>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Objet : {subject}</p>
              <iframe
                title={c.label}
                srcDoc={getEmailWrapperHtml(body)}
                style={{ width: '100%', height: 620, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

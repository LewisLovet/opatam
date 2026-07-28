/**
 * GET /api/loyalty/promo-unsubscribe?d=<docId>&t=<token> — désinscription
 * des emails promo d'un prestataire (lien RGPD dans chaque email promo).
 *
 * Sans auth : le token aléatoire par fiche (promoUnsubToken, généré au
 * premier envoi) fait office de capacité. Idempotent. Répond une petite
 * page HTML — le lien est ouvert depuis un client mail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

const page = (title: string, body: string) =>
  new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;max-width:420px;text-align:center;">
<p style="font-size:34px;margin:0 0 12px;">✉️</p>
<h1 style="font-size:20px;color:#111827;margin:0 0 8px;">${title}</h1>
<p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0;">${body}</p>
</div></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('d');
  const token = req.nextUrl.searchParams.get('t');
  if (!docId || !token) {
    return page('Lien invalide', 'Ce lien de désinscription est incomplet.');
  }
  try {
    const ref = getAdminFirestore().collection('providerClients').doc(docId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.promoUnsubToken !== token) {
      return page('Lien invalide', 'Ce lien de désinscription ne correspond à aucune inscription.');
    }
    // Désinscription sur TOUTES les fiches de ce client chez ce
    // prestataire. Un client qui a réservé sous deux adresses en possède
    // plusieurs : n'en désabonner qu'une laisserait la jumelle abonnée, et
    // le prochain envoi serait repris par elle — le client aurait cliqué
    // « ne plus recevoir » pour rien.
    const data = snap.data()!;
    const clientId = data.clientId as string | undefined;
    const providerId = data.providerId as string | undefined;
    const refs = [ref];
    if (clientId && providerId) {
      const siblings = await getAdminFirestore()
        .collection('providerClients')
        .where('clientId', '==', clientId)
        .limit(100)
        .get();
      for (const d of siblings.docs) {
        if (d.id !== ref.id && d.data().providerId === providerId) refs.push(d.ref);
      }
    }
    await Promise.all(refs.map((r) => r.update({ promoEmailsOptIn: false })));
    return page(
      'Désinscription confirmée',
      'Vous ne recevrez plus les promotions de ce prestataire par email. Vous pouvez les réactiver à tout moment depuis votre carte de fidélité dans l\'app Opatam. / You will no longer receive this provider\'s promotions.',
    );
  } catch (e) {
    console.error('[promo-unsubscribe] error:', e);
    return page('Erreur', 'Une erreur est survenue — réessayez dans quelques instants.');
  }
}

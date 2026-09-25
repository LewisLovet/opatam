import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

/**
 * POST /api/stripe/portal
 *
 * Ouvre le portail client Stripe du prestataire CONNECTÉ : son abonnement
 * Opatam, ses factures, sa carte.
 *
 * Sécurité : l'identifiant client Stripe n'est jamais pris dans la requête.
 * Il était lisible publiquement dans la fiche prestataire, et cette route
 * l'acceptait sans vérifier l'appelant : n'importe qui pouvait ouvrir le
 * portail d'un autre prestataire (factures, carte, résiliation). On le relit
 * désormais côté serveur à partir du jeton Firebase.
 *
 * L'adresse de retour n'est acceptée que sur notre propre domaine.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Connexion requise' }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length))).uid;
    } catch {
      return NextResponse.json({ message: 'Session expirée, reconnectez-vous' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { returnUrl?: string };

    const providerSnap = await getAdminFirestore().collection('providers').doc(uid).get();
    const customerId = providerSnap.data()?.subscription?.stripeCustomerId as string | undefined;
    if (!customerId) {
      return NextResponse.json(
        { message: 'Aucun abonnement Stripe associé à votre compte' },
        { status: 404 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    let returnUrl = `${appUrl}/pro/abonnement`;
    if (body.returnUrl) {
      try {
        const asked = new URL(body.returnUrl);
        const allowed = [new URL(appUrl).origin, request.nextUrl.origin];
        if (allowed.includes(asked.origin)) returnUrl = asked.toString();
      } catch {
        // adresse invalide : on garde la page abonnement
      }
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('[STRIPE-PORTAL] erreur :', error);
    const e = error as { type?: string; code?: string };
    if (e?.type === 'StripeInvalidRequestError' && e?.code === 'resource_missing') {
      return NextResponse.json(
        { message: 'Client Stripe introuvable. Votre compte a peut-être été créé dans un autre environnement (test/production). Veuillez re-souscrire.' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { message: "Impossible d'ouvrir le portail de gestion" },
      { status: 500 },
    );
  }
}

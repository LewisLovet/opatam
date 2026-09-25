import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';

/**
 * POST /api/pro/stripe-connect/dashboard-link
 *
 * Renvoie un lien de connexion à usage unique vers l'espace Stripe Express
 * du prestataire : solde des acomptes, virements, compte bancaire.
 *
 * À ne pas confondre avec le portail client (/api/stripe/portal), qui montre
 * ce que le prestataire PAIE à Opatam (abonnement, factures, carte). Ici on
 * montre ce qu'il REÇOIT de ses clientes.
 *
 * Le lien expire vite et ne sert qu'une fois : on le génère au clic, jamais
 * à l'avance. Le compte est toujours relu côté serveur à partir du jeton —
 * le client n'envoie aucun identifiant Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
    const uid = decoded.uid;

    const db = getAdminFirestore();

    // Même garde que /status tant que les acomptes restent sous drapeau.
    const userDoc = await db.collection('users').doc(uid).get();
    const isAdmin = userDoc.exists && userDoc.data()?.isAdmin === true;
    if (!canUseDepositsServer(isAdmin)) {
      return NextResponse.json(
        { error: 'Fonctionnalité réservée aux administrateurs pour le moment.' },
        { status: 403 },
      );
    }

    const providerSnap = await db.collection('providers').doc(uid).get();
    const accountId = providerSnap.data()?.stripeConnectAccountId as string | undefined;
    if (!accountId) {
      return NextResponse.json({ error: 'Aucun compte Stripe relié.' }, { status: 404 });
    }

    const stripe = getStripeDev();
    try {
      const link = await stripe.accounts.createLoginLink(accountId);
      return NextResponse.json({ url: link.url });
    } catch (e) {
      // Stripe refuse le lien tant que l'inscription n'est pas terminée.
      const msg = e instanceof Error ? e.message : '';
      console.warn('[stripe-connect/dashboard-link] refus Stripe :', msg);
      return NextResponse.json(
        { error: "Votre compte Stripe n'est pas encore finalisé. Terminez l'inscription d'abord." },
        { status: 409 },
      );
    }
  } catch (e) {
    console.error('[stripe-connect/dashboard-link] erreur :', e);
    return NextResponse.json({ error: 'Impossible d’ouvrir votre espace Stripe.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';

/**
 * POST /api/pro/stripe-connect/refresh-link
 *
 * Stripe onboarding URLs expire ~5 minutes after creation. When a pro
 * starts onboarding, walks away, and comes back, we hit this endpoint
 * to mint a fresh URL and resume right where they left off.
 *
 * Same auth contract as create-account: Bearer Firebase ID token.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = getAdminFirestore();

    // FIXME(deposits-launch): remove this gate when depositsPublic flips to true.
    const userDoc = await db.collection('users').doc(uid).get();
    const isAdmin = userDoc.exists && userDoc.data()?.isAdmin === true;
    if (!canUseDepositsServer(isAdmin)) {
      return NextResponse.json(
        { error: 'Fonctionnalité réservée aux administrateurs pour le moment.' },
        { status: 403 }
      );
    }

    const providerSnap = await db.collection('providers').doc(uid).get();
    if (!providerSnap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }
    const provider = providerSnap.data()!;
    const accountId = provider.stripeConnectAccountId as string | null;

    if (!accountId) {
      return NextResponse.json(
        { error: "Aucun compte Stripe Connect — utilisez create-account d'abord" },
        { status: 400 }
      );
    }

    // Use the same Stripe instance as create-account (test key in dev, live in prod)
    // so the account ID matches the environment that originally created it.
    const stripe = getStripeDev();
    const origin = request.headers.get('origin') ?? 'https://opatam.com';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/pro/paiements?connect=refresh`,
      return_url: `${origin}/pro/paiements?connect=return`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ onboardingUrl: accountLink.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/stripe-connect/refresh-link] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

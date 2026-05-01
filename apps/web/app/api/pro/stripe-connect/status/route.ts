import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/pro/stripe-connect/status
 *
 * Returns the live Stripe Connect status for the authenticated provider's
 * account. Used after the pro returns from Stripe onboarding to show
 * "Activé ✓" without waiting for the webhook to land (webhook is the
 * canonical source, this endpoint is a UX shortcut).
 *
 * Side effect: syncs the local Provider doc fields with Stripe's live
 * values, in case the webhook is delayed or missed.
 */
export async function GET(request: NextRequest) {
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

    const providerRef = db.collection('providers').doc(uid);
    const providerSnap = await providerRef.get();
    if (!providerSnap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }
    const provider = providerSnap.data()!;
    const accountId = provider.stripeConnectAccountId as string | null;

    // Pro hasn't started onboarding yet
    if (!accountId) {
      return NextResponse.json({
        accountId: null,
        status: null,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    // Use the same Stripe instance as create-account so we can read accounts
    // we created in test mode during development.
    const stripe = getStripeDev();

    let account: import('stripe').Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(accountId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Account exists in another env (live ↔ test mismatch). Surface it as
      // "not started" so the UI shows the activate CTA — clicking it
      // recreates a fresh account in the current environment.
      if (msg.includes('does not have access') || msg.includes('No such account')) {
        return NextResponse.json({
          accountId: null,
          status: null,
          chargesEnabled: false,
          payoutsEnabled: false,
        });
      }
      throw e;
    }

    const cardCap = account.capabilities?.card_payments ?? 'inactive';
    const transfersCap = account.capabilities?.transfers ?? 'inactive';

    // Mirror Stripe's view of the account into our derived status
    const status: 'pending' | 'active' | 'restricted' =
      cardCap === 'active' && transfersCap === 'active'
        ? 'active'
        : cardCap === 'pending' || transfersCap === 'pending'
        ? 'pending'
        : 'restricted';

    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;

    // Sync local provider doc only if anything changed
    if (
      provider.stripeConnectStatus !== status ||
      provider.stripeConnectChargesEnabled !== chargesEnabled ||
      provider.stripeConnectPayoutsEnabled !== payoutsEnabled
    ) {
      await providerRef.update({
        stripeConnectStatus: status,
        stripeConnectChargesEnabled: chargesEnabled,
        stripeConnectPayoutsEnabled: payoutsEnabled,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      accountId,
      status,
      chargesEnabled,
      payoutsEnabled,
      requirements: {
        currentlyDue: account.requirements?.currently_due ?? [],
        eventuallyDue: account.requirements?.eventually_due ?? [],
        disabledReason: account.requirements?.disabled_reason ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/stripe-connect/status] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

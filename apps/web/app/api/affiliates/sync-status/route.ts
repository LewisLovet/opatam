import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/affiliates/sync-status
 *
 * Re-fetches the Stripe Connect account of the given affiliate and
 * updates `stripeAccountStatus` in Firestore if it has changed.
 *
 * Called by the affiliate dashboard on mount and especially when the
 * affiliate comes back from Stripe onboarding. Also safe to call at
 * any time — idempotent, only writes when the status actually differs.
 *
 * Body: { affiliateId: string, force?: boolean }
 *   - force is a hint used for logging; the endpoint performs the same
 *     work regardless.
 */
export async function POST(request: NextRequest) {
  try {
    const { affiliateId } = (await request.json()) as { affiliateId?: string };
    if (!affiliateId) {
      return NextResponse.json({ error: 'affiliateId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection('affiliates').doc(affiliateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Affilié non trouvé' }, { status: 404 });
    }

    const data = doc.data()!;
    if (!data.stripeAccountId) {
      return NextResponse.json({ error: 'Pas de compte Stripe associé' }, { status: 400 });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(data.stripeAccountId);

    const transfersStatus = account.capabilities?.transfers || 'not_requested';
    const newStatus: 'active' | 'pending' | 'restricted' =
      transfersStatus === 'active'
        ? 'active'
        : transfersStatus === 'pending'
        ? 'pending'
        : 'restricted';

    const previousStatus = data.stripeAccountStatus as string | undefined;
    const changed = previousStatus !== newStatus;

    if (changed) {
      await docRef.update({
        stripeAccountStatus: newStatus,
        updatedAt: new Date(),
      });
      console.log(
        `[affiliates/sync-status] ${affiliateId}: ${previousStatus} → ${newStatus}`
      );
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      previousStatus: previousStatus ?? null,
      changed,
      transfersStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err) {
    console.error('[affiliates/sync-status] error:', err);
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev, getDepositsAddonPriceId } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/pro/deposits-addon/deactivate
 *
 * Removes the deposits add-on subscription item from the pro's Stripe
 * subscription. By default we use `proration_behavior: 'none'` so the
 * pro keeps the feature until the end of the current billing period —
 * they already paid for it.
 *
 * Idempotent — if the item isn't on the subscription, returns success.
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

    const providerRef = db.collection('providers').doc(uid);
    const providerSnap = await providerRef.get();
    if (!providerSnap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }
    const provider = providerSnap.data()!;

    const subscriptionId = provider.subscription?.stripeSubscriptionId as string | null;
    if (!subscriptionId) {
      // No subscription means no add-on either. Just clear the local flag.
      if (provider.depositsAddonActive) {
        await providerRef.update({
          depositsAddonActive: false,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return NextResponse.json({ ok: true, no_subscription: true });
    }

    const stripe = getStripeDev();
    const addonPriceId = await getDepositsAddonPriceId(stripe);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const addonItem = subscription.items.data.find(
      (it) => it.price.id === addonPriceId
    );

    if (!addonItem) {
      // Already removed — sync the local flag if it's stale and return.
      if (provider.depositsAddonActive) {
        await providerRef.update({
          depositsAddonActive: false,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return NextResponse.json({ ok: true, already_inactive: true });
    }

    // Remove the add-on item. `proration_behavior: 'none'` means the pro
    // keeps the feature until the end of the current billing period
    // (they already paid for the month).
    await stripe.subscriptionItems.del(addonItem.id, {
      proration_behavior: 'none',
    });

    await providerRef.update({
      depositsAddonActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/deposits-addon/deactivate] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

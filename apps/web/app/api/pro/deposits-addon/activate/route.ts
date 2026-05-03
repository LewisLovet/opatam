import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev, getDepositsAddonPriceId } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/pro/deposits-addon/activate
 *
 * Stacks a +5€/mo subscription item on the pro's existing Stripe subscription.
 * Stripe handles proration automatically: the pro is charged a prorated
 * amount immediately for the rest of the current billing period, then the
 * regular charge is included in their next invoice.
 *
 * Idempotent — calling it twice in a row is a no-op.
 *
 * Pre-flight checks:
 *  - Pro must be authenticated (Bearer Firebase ID token)
 *  - Pro must have an active Stripe subscription (i.e. not pure trial)
 *  - Pro should have completed Stripe Connect onboarding (required to
 *    actually use the feature, but we don't strictly enforce it here —
 *    they can pay for the add-on first and finish Connect after)
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
      return NextResponse.json(
        {
          error:
            "Aucun abonnement actif. Souscrivez d'abord à un plan payant avant d'ajouter l'add-on Acomptes.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeDev();
    const addonPriceId = await getDepositsAddonPriceId(stripe);

    // Already active? Avoid creating a duplicate item.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const existingItem = subscription.items.data.find(
      (it) => it.price.id === addonPriceId
    );

    if (existingItem) {
      // Already on the subscription — just sync our local flag and return.
      if (!provider.depositsAddonActive) {
        await providerRef.update({
          depositsAddonActive: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return NextResponse.json({ ok: true, already_active: true });
    }

    // Add the addon as a new subscription item with prorated immediate billing
    await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: addonPriceId,
      quantity: 1,
      proration_behavior: 'create_prorations',
    });

    // Optimistic local update — the canonical update comes from the
    // customer.subscription.updated webhook a few hundred ms later.
    await providerRef.update({
      depositsAddonActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/deposits-addon/activate] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

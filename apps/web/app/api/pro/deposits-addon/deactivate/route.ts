import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/pro/deposits-addon/deactivate
 *
 * Cancels the pro's Sérénité subscription at the END of the current
 * billing period (Option B). The pro keeps access until then —
 * they already paid for the month, no good reason to take it away
 * mid-cycle. At period end the Stripe webhook fires
 * `customer.subscription.deleted`, which flips
 * `depositsAddonActive: false` and `serenity.status: 'cancelled'`.
 *
 * Until that period end:
 *   - `serenity.cancelAtPeriodEnd: true` (so the UI can show
 *     "Résiliation prévue le DD/MM")
 *   - `depositsAddonActive: true` (the pro still has access)
 *
 * Idempotent — if no Sérénité sub exists, returns success with a
 * sync of the local flag.
 *
 * Decoupled from the base Pro plan: the v1.4 version used to
 * delete an item from the base Stripe sub, which crashed when the
 * Apple-billed flow had stuffed a Sérénité-only sub into the
 * `subscription.stripeSubscriptionId` field. The new model reads
 * exclusively from `provider.serenity.*`.
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

    const serenitySubId =
      (provider.serenity?.stripeSubscriptionId as string | null | undefined) ??
      null;

    // No Sérénité sub on file → just clear the local flag if it's
    // stale and return. Covers the "user clicked twice / race with
    // webhook" case.
    if (!serenitySubId) {
      if (provider.depositsAddonActive) {
        await providerRef.update({
          depositsAddonActive: false,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return NextResponse.json({ ok: true, no_subscription: true });
    }

    const stripe = getStripeDev();

    // Schedule a cancel at period end. The sub stays `active` for
    // now; the webhook will eventually receive
    // `customer.subscription.deleted` when the billing cycle wraps
    // up, at which point we flip `depositsAddonActive: false`.
    let updated;
    try {
      updated = await stripe.subscriptions.update(serenitySubId, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      // Sub doesn't exist on Stripe anymore (already cancelled,
      // wrong env after a clone, etc.). Sync local state and
      // call it a day — no point bubbling the error up to the
      // UI when the desired end state is already "cancelled".
      console.warn('[deposits-addon/deactivate] Stripe sub update failed:', err);
      await providerRef.update({
        depositsAddonActive: false,
        'serenity.status': 'cancelled',
        'serenity.cancelAtPeriodEnd': false,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, already_cancelled: true });
    }

    // Optimistic local update — `cancel_at_period_end: true` plus
    // the existing `currentPeriodEnd` is what the UI needs to render
    // "Résiliation prévue le DD/MM". The status stays whatever
    // Stripe reported (still `active` typically) until period end.
    await providerRef.update({
      'serenity.cancelAtPeriodEnd': true,
      'serenity.status': updated.status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Stripe SDK v20+: `current_period_end` moved to the
    // subscription *item* level. Probe both for back-compat.
    const periodEndSec =
      ((updated.items?.data?.[0] as unknown as { current_period_end?: number })
        ?.current_period_end) ??
      (updated as unknown as { current_period_end?: number }).current_period_end;

    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEndSec ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/deposits-addon/deactivate] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

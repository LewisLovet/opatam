import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev, getStripe, getDepositsAddonPriceId } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type Stripe from 'stripe';

/**
 * POST /api/dev/migrate-serenity
 *
 * One-shot migration helper for Sérénité v1.4 → v1.5.
 *
 * v1.4 stored Sérénité as an extra Item on the provider's base
 * Stripe subscription (the one tracked in
 * `subscription.stripeSubscriptionId`). v1.5 moves Sérénité to a
 * dedicated Stripe sub stored in `provider.serenity.*`, so an
 * Apple-billed pro can also subscribe to Sérénité without polluting
 * their base subscription state.
 *
 * What this endpoint does for a target provider:
 *   1. Detect the legacy "addon as item" state — base sub contains
 *      both the Pro Price AND the Sérénité Price as items.
 *   2. Cancel the legacy addon item on the base sub (`subscriptionItems.del`).
 *   3. Create a fresh dedicated Stripe sub on the same Customer
 *      with just the Sérénité Price + the v1.5 metadata
 *      (`productType: 'serenity'`).
 *   4. Reuse the Customer's existing default payment method so
 *      no PaymentIntent confirmation is required — the migration
 *      is seamless from the pro's side.
 *   5. Mirror the new sub into `provider.serenity.*` and flip
 *      `depositsAddonActive: true` (it was already true before;
 *      we just keep it true through the migration).
 *
 * Idempotent — re-running on a provider already on v1.5 is a no-op.
 *
 * Admin-gated via `users/{uid}.isAdmin === true`. The endpoint
 * accepts a `?providerId=<uid>` query param so a platform admin
 * can migrate any pro on their behalf; without the param, it
 * targets the caller's own provider doc.
 *
 * Run once per affected pro after deploying the v1.5 backend.
 * After all known affected providers are migrated, this route
 * can be removed.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const callerUid = decoded.uid;

    const db = getAdminFirestore();

    // Admin gate — match the convention used by the deposits feature flag.
    const callerDoc = await db.collection('users').doc(callerUid).get();
    const isAdmin = callerDoc.exists && callerDoc.data()?.isAdmin === true;
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Réservé aux administrateurs.' },
        { status: 403 }
      );
    }

    // Target provider — defaults to the caller's own doc.
    const { searchParams } = request.nextUrl;
    const targetProviderId = searchParams.get('providerId') ?? callerUid;

    const providerRef = db.collection('providers').doc(targetProviderId);
    const providerSnap = await providerRef.get();
    if (!providerSnap.exists) {
      return NextResponse.json(
        { error: `Provider ${targetProviderId} introuvable` },
        { status: 404 }
      );
    }
    const provider = providerSnap.data()!;

    // Already on v1.5 — has a `serenity` sub-object with an id. No-op.
    if (provider.serenity?.stripeSubscriptionId) {
      return NextResponse.json({
        ok: true,
        already_migrated: true,
        serenitySubId: provider.serenity.stripeSubscriptionId,
      });
    }

    const baseSubId = provider.subscription?.stripeSubscriptionId as string | null | undefined;
    if (!baseSubId) {
      // Apple/Google base, no Sérénité legacy state to migrate.
      // Just normalise the `serenity` field to null so the new code
      // reads consistently.
      await providerRef.update({
        serenity: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, no_legacy_state: true });
    }

    // Determine which env the Stripe IDs live in (test vs live)
    // so we hit the right Stripe instance. Try test first since
    // dev usage dominates here.
    let stripe: Stripe = getStripeDev();
    let env: 'test' | 'live' = 'test';
    try {
      await stripe.subscriptions.retrieve(baseSubId);
    } catch {
      stripe = getStripe();
      env = 'live';
      try {
        await stripe.subscriptions.retrieve(baseSubId);
      } catch (err) {
        return NextResponse.json(
          {
            error: `Base sub ${baseSubId} introuvable en test ET en live`,
            details: err instanceof Error ? err.message : String(err),
          },
          { status: 422 }
        );
      }
    }

    const baseSub = await stripe.subscriptions.retrieve(baseSubId);
    const addonPriceId = await getDepositsAddonPriceId(stripe);

    const addonItem = baseSub.items.data.find((it) => it.price.id === addonPriceId);
    if (!addonItem) {
      // Sérénité isn't on the base sub at all → nothing to migrate.
      // Just make sure depositsAddonActive reflects reality.
      await providerRef.update({
        depositsAddonActive: false,
        serenity: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, no_addon_item: true });
    }

    // ── Step 1: detach the addon item from the base sub ──────────────
    // `proration_behavior: 'none'` mirrors the previous deactivate
    // behaviour — the pro keeps the feature until end of current
    // billing period anyway, and we re-create the dedicated sub
    // right after so there's no actual gap in access.
    await stripe.subscriptionItems.del(addonItem.id, {
      proration_behavior: 'none',
    });

    // ── Step 2: create a fresh dedicated sub on the same Customer ────
    const customerId = extractId(baseSub.customer);
    if (!customerId) {
      return NextResponse.json(
        { error: 'Base sub has no customer attached, cannot create dedicated Sérénité sub' },
        { status: 500 }
      );
    }

    // Re-use the customer's default payment method so the new sub
    // can charge immediately without a PaymentIntent confirmation
    // dance. If the customer has no default PM (unlikely since the
    // base sub was paying), Stripe will create the sub as `incomplete`
    // and the next invoice will fail — surfaced as `past_due` later.
    const newSub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: addonPriceId }],
      proration_behavior: 'none',
      metadata: {
        providerId: targetProviderId,
        productType: 'serenity',
        migratedFrom: baseSubId,
      },
    });

    // ── Step 3: mirror the new sub into provider.serenity.* ──────────
    const rawEnd = (newSub as unknown as { current_period_end?: number }).current_period_end;
    const currentPeriodEnd =
      typeof rawEnd === 'number' ? Timestamp.fromMillis(rawEnd * 1000) : null;

    await providerRef.update({
      'serenity.stripeCustomerId': customerId,
      'serenity.stripeSubscriptionId': newSub.id,
      'serenity.status': newSub.status,
      'serenity.currentPeriodEnd': currentPeriodEnd,
      'serenity.cancelAtPeriodEnd': false,
      depositsAddonActive: newSub.status === 'active' || newSub.status === 'trialing',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      env,
      legacyAddonItemId: addonItem.id,
      newSerenitySubId: newSub.id,
      newSerenitySubStatus: newSub.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[DEV/migrate-serenity] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Coerce a Stripe-SDK union (string | object) into a plain id. */
function extractId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  return ref.id ?? null;
}

import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev, getDepositsAddonPriceId } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * POST /api/pro/deposits-addon/activate
 *
 * Activates the Sérénité add-on (acomptes) for a provider by
 * creating a DEDICATED Stripe subscription with a single Sérénité
 * price item — independent of whatever sub backs the base Pro plan.
 *
 * This decoupling is what lets Apple-billed and Google-billed pros
 * subscribe to Sérénité at all: the previous version required a
 * pre-existing Stripe sub (which only Stripe-billed pros have).
 * Now any pro with an active base plan can add Sérénité, and the
 * field lives in `provider.serenity.*` instead of mixing with
 * `provider.subscription.*` which only tracks the Pro plan.
 *
 * Idempotent — if Sérénité is already active, returns success
 * without creating a duplicate Stripe sub.
 *
 * Pre-flight checks:
 *  - Pro must be authenticated (Bearer Firebase ID token)
 *  - Pro must have an ACTIVE base subscription (any paymentSource).
 *    Sérénité is an add-on, not a standalone product.
 *  - Pro must have an ACTIVE Stripe Connect account. Hard-enforced
 *    here as defense-in-depth: subscribing without an active Connect
 *    account leads to failed deposit charges, which silently blocks
 *    every new booking. Better to refuse upfront than to take 5€ for
 *    a feature that can't actually run.
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

    // ── Gate 1: base subscription must be active ─────────────────────
    // Sérénité is an add-on. We don't allow it without a paying base
    // plan, regardless of the payment source (Stripe / Apple / Google).
    // `validUntil` is the source of truth used elsewhere in the app
    // for the "is this pro paid up?" check, so we mirror it here.
    const subStatus = provider.subscription?.status as string | undefined;
    const validUntilRaw = provider.subscription?.validUntil;
    const validUntil =
      validUntilRaw instanceof Timestamp
        ? validUntilRaw.toDate()
        : validUntilRaw instanceof Date
          ? validUntilRaw
          : null;
    const baseActive =
      (subStatus === 'active' || subStatus === 'trialing') &&
      validUntil !== null &&
      validUntil.getTime() > Date.now();
    if (!baseActive) {
      return NextResponse.json(
        {
          error:
            "Aucun abonnement actif. Souscrivez d'abord à un plan Pro avant d'ajouter Sérénité.",
        },
        { status: 400 }
      );
    }

    // ── Gate 2: Stripe Connect must be active ────────────────────────
    if (provider.stripeConnectStatus !== 'active') {
      return NextResponse.json(
        {
          error:
            "Activez d'abord Stripe Connect. Sans compte vérifié, les acomptes ne pourraient pas être encaissés.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeDev();
    const addonPriceId = await getDepositsAddonPriceId(stripe);

    // ── Idempotency: already active? ─────────────────────────────────
    // If `serenity.stripeSubscriptionId` is set and the Stripe sub
    // is still alive, we no-op. This catches retries and
    // double-clicks. We don't trust the local `depositsAddonActive`
    // boolean alone since it can drift; we hit Stripe to be sure.
    const existingSerenitySubId = provider.serenity?.stripeSubscriptionId as string | null | undefined;
    if (existingSerenitySubId) {
      try {
        const existing = await stripe.subscriptions.retrieve(existingSerenitySubId);
        if (existing.status === 'active' || existing.status === 'trialing') {
          // Sync the local flag in case it drifted but don't create a
          // duplicate sub.
          if (!provider.depositsAddonActive) {
            await providerRef.update({
              depositsAddonActive: true,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          return NextResponse.json({ ok: true, already_active: true });
        }
      } catch {
        // Stripe couldn't find the sub (deleted / wrong env / id rot).
        // Fall through and create a fresh sub.
      }
    }

    // ── Resolve a Stripe Customer for billing Sérénité ───────────────
    // Reuse the existing Customer when the base plan is also Stripe-
    // billed (keeps one billing relationship for the provider). For
    // Apple/Google-billed bases, mint a new Customer with the pro's
    // email so receipts go to the right address.
    let stripeCustomerId =
      (provider.serenity?.stripeCustomerId as string | null | undefined) ??
      null;

    if (!stripeCustomerId && provider.subscription?.paymentSource === 'stripe') {
      stripeCustomerId =
        (provider.subscription?.stripeCustomerId as string | null | undefined) ??
        null;
    }

    if (!stripeCustomerId) {
      const userRecord = await getAdminAuth().getUser(uid);
      const customer = await stripe.customers.create({
        email: userRecord.email ?? undefined,
        name:
          (provider.businessName as string | undefined) ??
          userRecord.displayName ??
          undefined,
        metadata: {
          providerId: uid,
          productType: 'serenity',
        },
      });
      stripeCustomerId = customer.id;
    }

    // ── Default payment method ───────────────────────────────────────
    // Stripe needs a payment method to bill. For Stripe-billed bases
    // we typically already have one attached to the Customer. For
    // Apple/Google-billed bases we don't, and we can't proceed
    // without one. The UI takes care of this by sending the pro
    // through a SetupIntent-backed PaymentSheet first; this endpoint
    // expects a `default_payment_method` to already exist OR the
    // client to have just attached one (passed in via the request
    // body — see optional `paymentMethodId`).
    const body = await request.json().catch(() => ({}));
    const paymentMethodId =
      typeof body?.paymentMethodId === 'string' ? body.paymentMethodId : null;
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // ── Create the dedicated Sérénité subscription ───────────────────
    // Single item (the Sérénité price). The webhook keys on the
    // `productType: 'serenity'` metadata to route the resulting
    // events into `provider.serenity.*` instead of clobbering the
    // base `provider.subscription.*` fields.
    const newSub = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: addonPriceId }],
      proration_behavior: 'create_prorations',
      metadata: {
        providerId: uid,
        productType: 'serenity',
      },
      // Behaviour when the first invoice can't be paid (no payment
      // method, declined card, etc.). 'default_incomplete' creates
      // the sub in `incomplete` state and returns a PaymentIntent
      // the client can complete; safer than silently failing.
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    // Type guards on the expanded invoice → payment_intent. The
    // Stripe SDK v20 dropped `payment_intent` from the `Invoice`
    // typing but it's still emitted on the wire when expanded —
    // cast pragmatically to retrieve the client_secret. Matches
    // the `(x as any)` pattern used elsewhere in the webhook to
    // read the moved `current_period_end` field.
    const latestInvoice =
      newSub.latest_invoice && typeof newSub.latest_invoice !== 'string'
        ? (newSub.latest_invoice as unknown as {
            payment_intent?: string | { client_secret?: string } | null;
          })
        : null;
    const paymentIntent =
      latestInvoice?.payment_intent &&
      typeof latestInvoice.payment_intent !== 'string'
        ? latestInvoice.payment_intent
        : null;

    // ── Persist locally (optimistic — webhook will re-confirm) ───────
    // Same trick as the webhook's getSubscriptionPeriodEnd: since
    // Stripe API 2025-03-31, `current_period_end` lives on each
    // subscription *item*, not the sub itself. Try both locations.
    const periodEndSec =
      ((newSub.items?.data?.[0] as unknown as { current_period_end?: number })
        ?.current_period_end) ??
      (newSub as unknown as { current_period_end?: number }).current_period_end;
    const currentPeriodEnd =
      typeof periodEndSec === 'number' && periodEndSec > 0
        ? Timestamp.fromMillis(periodEndSec * 1000)
        : null;

    await providerRef.update({
      'serenity.stripeCustomerId': stripeCustomerId,
      'serenity.stripeSubscriptionId': newSub.id,
      'serenity.status': newSub.status,
      'serenity.currentPeriodEnd': currentPeriodEnd,
      'serenity.cancelAtPeriodEnd': false,
      depositsAddonActive: newSub.status === 'active' || newSub.status === 'trialing',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: newSub.id,
      status: newSub.status,
      // When the sub is created `incomplete`, the client needs to
      // confirm the PaymentIntent (3DS, Apple Pay sheet, etc.).
      // Returning the secret keeps the UI in charge of that step
      // without a second round-trip to fetch it.
      clientSecret: paymentIntent?.client_secret ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/deposits-addon/activate] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

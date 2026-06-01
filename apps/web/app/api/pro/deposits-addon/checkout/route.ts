import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev, getDepositsAddonPriceId } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * POST /api/pro/deposits-addon/checkout
 *
 * WEB activation of the Sérénité add-on (acomptes) via Stripe
 * Checkout (hosted, `mode: 'subscription'`).
 *
 * Why a separate route from `activate`: the mobile app drives
 * activation through a PaymentSheet and POSTs a `paymentMethodId`
 * to `activate`, which then creates the sub server-side. On the
 * web there's no card collected up front — the old web flow created
 * an `incomplete` sub that nobody ever confirmed, so Stripe
 * auto-cancelled it ~24h later and the add-on never activated.
 *
 * This route instead hands off to Stripe's hosted Checkout page,
 * which ALWAYS collects a card and handles 3DS/SCA. The first
 * Sérénité invoice is paid right there; the existing webhook
 * (`invoice.payment_succeeded` with `productType: 'serenity'`)
 * flips `serenity.status:'active'` + `depositsAddonActive:true`.
 *
 * Pre-flight checks mirror `activate`:
 *  - Pro must be authenticated (Bearer Firebase ID token)
 *  - Pro must have an ACTIVE base subscription (any paymentSource)
 *  - Pro must have an ACTIVE Stripe Connect account
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

    // ── Gate 1: base subscription must be active (not trial) ────────
    const subStatus = provider.subscription?.status as string | undefined;
    const validUntilRaw = provider.subscription?.validUntil;
    const validUntil =
      validUntilRaw instanceof Timestamp
        ? validUntilRaw.toDate()
        : validUntilRaw instanceof Date
          ? validUntilRaw
          : null;

    if (subStatus === 'trialing') {
      return NextResponse.json(
        {
          error:
            "Sérénité est réservé aux abonnements payants. Attendez la fin de votre période d'essai pour souscrire.",
        },
        { status: 400 }
      );
    }

    const baseActive =
      subStatus === 'active' &&
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

    // ── Hosted Checkout session ──────────────────────────────────────
    // `payment_method_collection: 'always'` guarantees Stripe asks
    // for a card even if the Customer somehow already had one — the
    // whole point of this flow is to never end up with an unpaid
    // `incomplete` sub again. The `subscription_data.metadata` is
    // what the webhook keys on to route the resulting events into
    // `provider.serenity.*`.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: addonPriceId, quantity: 1 }],
      subscription_data: {
        metadata: { providerId: uid, productType: 'serenity' },
      },
      payment_method_collection: 'always',
      // Lets the pro enter a Stripe promotion code on the hosted page.
      // The actual codes/coupons are created in the Stripe Dashboard
      // (Products → Coupons → Promotion codes); this flag just exposes
      // the "Add promotion code" field in Checkout.
      allow_promotion_codes: true,
      success_url: `${appUrl}/pro/parametres?tab=paiements&serenity=success`,
      cancel_url: `${appUrl}/pro/parametres?tab=paiements&serenity=cancel`,
      metadata: { providerId: uid, productType: 'serenity' },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/deposits-addon/checkout] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

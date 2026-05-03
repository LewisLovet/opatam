import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  getStripe,
  getStripeDev,
  getDepositsAddonPriceId,
  getWebhookSecrets,
} from '@/lib/stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';
import { generatePlanChangeEmail } from '@/lib/emails/planChange';

// ---------------------------------------------------------------------------
// Stripe Webhook Handler
// ---------------------------------------------------------------------------
// This route receives raw POST bodies from Stripe, verifies the signature,
// and dispatches to the appropriate handler. It ALWAYS returns 200 to avoid
// Stripe retrying events endlessly — errors are logged for investigation.
// ---------------------------------------------------------------------------

/**
 * Safely extract an ID from a Stripe field that may be a string or an
 * expanded object (e.g. session.subscription can be "sub_xxx" or { id: "sub_xxx", ... }).
 * This is critical for Stripe SDK v20+ where many fields can be expanded objects.
 */
function extractId(field: string | { id: string } | null | undefined): string | null {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && 'id' in field) return field.id;
  return null;
}

/**
 * Extract the billing period end from a subscription.
 * Since Stripe API 2025-03-31 (SDK v20+), `current_period_end` has moved
 * from the subscription level to the subscription *item* level.
 * We try the item-level field first, then fall back to the legacy top-level
 * field for backwards-compatibility.
 */
function getSubscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  // New location: items.data[0].current_period_end
  const itemEnd = (sub.items?.data?.[0] as any)?.current_period_end;
  if (typeof itemEnd === 'number' && itemEnd > 0) return itemEnd;

  // Legacy location (API versions before 2025-03-31)
  const subEnd = (sub as any).current_period_end;
  if (typeof subEnd === 'number' && subEnd > 0) return subEnd;

  return null;
}

export async function POST(request: NextRequest) {
  console.log('[STRIPE-WEBHOOK] ========== EVENT RECEIVED ==========');

  const body = await request.text(); // RAW body for signature verification
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.log('[STRIPE-WEBHOOK] ERROR: No signature');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  // Verify the signature against each configured secret in turn. We can
  // legitimately have multiple in dev (one for platform events, one for
  // Connect events forwarded from `stripe listen --forward-connect-to`).
  // We only need ONE to match. The Stripe instance below is just a vehicle
  // for the static webhooks helper — choice of test/live happens later.
  let event: Stripe.Event | null = null;
  let lastError: unknown = null;
  for (const secret of getWebhookSecrets()) {
    try {
      event = getStripe().webhooks.constructEvent(body, signature, secret);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!event) {
    const message = lastError instanceof Error ? lastError.message : 'Unknown error';
    console.error('[STRIPE-WEBHOOK] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Pick the Stripe instance matching the event's environment, so any
  // follow-up API calls (expand, refund, retrieve…) hit the right
  // account. Stripe sends livemode=false for test-mode events.
  const stripe = event.livemode ? getStripe() : getStripeDev();

  console.log(
    `[STRIPE-WEBHOOK] Event type: ${event.type}, ID: ${event.id}, livemode: ${event.livemode}`
  );

  const db = getAdminFirestore();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Two flavors of checkout.session.completed live in this app:
        //  - subscription checkout (metadata.providerId set, no bookingId)
        //  - booking deposit checkout (metadata.bookingId set, on a
        //    connected account)
        if (session.metadata?.bookingId) {
          await handleDepositCheckoutCompleted(db, session);
        } else {
          await handleCheckoutCompleted(db, stripe, session);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.bookingId) {
          await handleDepositCheckoutExpired(db, session);
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(db, charge);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(db, stripe, invoice);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(db, stripe, subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(db, stripe, subscription);
        break;
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleConnectAccountUpdated(db, account);
        break;
      }
      default:
        console.log(`[STRIPE-WEBHOOK] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[STRIPE-WEBHOOK] Error handling ${event.type}:`, error instanceof Error ? error.stack || error.message : String(error));
    // Return 200 anyway to prevent Stripe from retrying in a loop.
    // The error is logged for investigation.
  }

  console.log('[STRIPE-WEBHOOK] ========== EVENT PROCESSED ==========');
  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  console.log('[STRIPE-WEBHOOK] checkout.session.completed');

  const providerId = session.metadata?.providerId;
  if (!providerId) {
    console.error('[STRIPE-WEBHOOK] No providerId in session metadata');
    return;
  }

  // session.subscription / session.customer can be strings OR expanded objects
  const subscriptionId = extractId(session.subscription as any);
  const customerId = extractId(session.customer as any);

  console.log(`[STRIPE-WEBHOOK] providerId: ${providerId}`);
  console.log(`[STRIPE-WEBHOOK] subscriptionId: ${subscriptionId} (raw type: ${typeof session.subscription})`);
  console.log(`[STRIPE-WEBHOOK] customerId: ${customerId} (raw type: ${typeof session.customer})`);

  if (!subscriptionId || !customerId) {
    console.error('[STRIPE-WEBHOOK] Missing subscriptionId or customerId in session');
    return;
  }

  // Retrieve the Stripe subscription for detailed info
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  console.log(`[STRIPE-WEBHOOK] Stripe subscription status: ${stripeSubscription.status}`);

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    console.warn(`[STRIPE-WEBHOOK] Provider ${providerId} not found in Firestore, skipping`);
    return;
  }

  // Determine the plan: prefer Stripe metadata, fall back to existing Firestore value
  const existingData = providerDoc.data();
  const existingPlan = existingData?.plan ?? 'solo';
  const plan = stripeSubscription.metadata?.plan || existingPlan;

  // Log if we're overriding an IAP subscription (user chose to pay via Stripe instead)
  const existingSource = existingData?.subscription?.paymentSource;
  if (existingSource === 'apple' || existingSource === 'google') {
    console.log(`[STRIPE-WEBHOOK] Note: Provider ${providerId} switching from ${existingSource} IAP to Stripe`);
  }
  console.log(`[STRIPE-WEBHOOK] Plan from metadata: ${stripeSubscription.metadata?.plan ?? 'MISSING'}, existing: ${existingPlan} → using: ${plan}`);

  const rawEnd = getSubscriptionPeriodEnd(stripeSubscription);
  const periodEnd = rawEnd ? new Date(rawEnd * 1000) : null;
  console.log(`[STRIPE-WEBHOOK] periodEnd: ${periodEnd?.toISOString() ?? 'null'}`);

  // Determine validUntil: take the latest between existing validUntil (trial) and Stripe periodEnd
  const existingValidUntil = existingData?.subscription?.validUntil?.toDate?.() ?? null;
  let newValidUntil = periodEnd;
  if (existingValidUntil && periodEnd) {
    newValidUntil = existingValidUntil > periodEnd ? existingValidUntil : periodEnd;
  } else if (existingValidUntil && !periodEnd) {
    newValidUntil = existingValidUntil;
  }
  console.log(`[STRIPE-WEBHOOK] existingValidUntil: ${existingValidUntil?.toISOString() ?? 'null'}, newValidUntil: ${newValidUntil?.toISOString() ?? 'null'}`);

  // Count active members for the provider
  const membersSnapshot = await db
    .collection('providers')
    .doc(providerId)
    .collection('members')
    .where('isActive', '==', true)
    .get();
  const activeMemberCount = membersSnapshot.size;

  const updateData: Record<string, any> = {
    plan: plan,
    'subscription.plan': plan,
    'subscription.status': stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
    'subscription.stripeCustomerId': customerId,
    'subscription.stripeSubscriptionId': subscriptionId,
    'subscription.cancelAtPeriodEnd': stripeSubscription.cancel_at_period_end,
    'subscription.memberCount': activeMemberCount,
    'subscription.paymentSource': 'stripe',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (periodEnd) {
    updateData['subscription.currentPeriodEnd'] = periodEnd;
  }
  if (newValidUntil) {
    updateData['subscription.validUntil'] = newValidUntil;
  }

  await providerRef.update(updateData);

  console.log(`[STRIPE-WEBHOOK] Provider ${providerId} subscription activated (${activeMemberCount} active members)`);

  // Fire-and-forget: affiliate commission transfer
  try {
    const affCode = session.metadata?.affiliateCode;
    const affId = session.metadata?.affiliateId;
    const amountTotal = session.amount_total; // amount actually paid (after discount)

    if (affId && amountTotal && amountTotal > 0) {
      const affiliateDoc = await db.collection('affiliates').doc(affId).get();
      if (affiliateDoc.exists) {
        const affiliate = affiliateDoc.data()!;
        if (affiliate.isActive && affiliate.stripeAccountId && affiliate.stripeAccountStatus === 'active') {
          const commissionCents = Math.round(amountTotal * (affiliate.commission / 100));
          if (commissionCents > 0) {
            // Get the latest charge from the session
            const chargeId = typeof session.payment_intent === 'string'
              ? (await stripe.paymentIntents.retrieve(session.payment_intent)).latest_charge as string
              : null;

            if (chargeId) {
              const transfer = await stripe.transfers.create({
                amount: commissionCents,
                currency: 'eur',
                destination: affiliate.stripeAccountId,
                source_transaction: chargeId,
                metadata: {
                  affiliateCode: affCode || '',
                  affiliateId: affId,
                  providerId,
                },
              });

              // Update affiliate stats
              await db.collection('affiliates').doc(affId).update({
                'stats.activeReferrals': (affiliate.stats?.activeReferrals || 0) + 1,
                'stats.totalRevenue': (affiliate.stats?.totalRevenue || 0) + amountTotal,
                'stats.totalCommission': (affiliate.stats?.totalCommission || 0) + commissionCents,
                updatedAt: new Date(),
              });

              // Log
              await db.collection('_affiliateLogs').add({
                type: 'payment',
                affiliateId: affId,
                affiliateCode: affCode,
                providerId,
                paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
                transferId: transfer.id,
                amount: amountTotal,
                commission: commissionCents,
                commissionRate: affiliate.commission,
                source: 'checkout',
                createdAt: new Date(),
              });

              console.log(`[STRIPE-WEBHOOK] Affiliate transfer: ${commissionCents} cents to ${affiliate.code} (${transfer.id})`);
            }
          }
        }
      }
    }
  } catch (affiliateErr) {
    console.error('[STRIPE-WEBHOOK] Affiliate transfer error (non-blocking):', affiliateErr);
  }

  // Fire-and-forget: send welcome email
  try {
    const providerEmail = existingData?.email || existingData?.contactEmail;
    const providerDisplayName = existingData?.businessName || existingData?.name || 'Professionnel';
    if (providerEmail) {
      const PLAN_FEATURES: Record<string, string[]> = {
        Pro: [
          'Réservations illimitées, 0% de commission',
          'Votre vitrine en ligne professionnelle',
          'Rappels automatiques email et push',
          'Agenda accessible partout, 24h/24',
          'Prêt en 5 minutes, sans formation',
        ],
        Studio: [
          'Jusqu\'à 10 agendas synchronisés',
          '0% de commission, même en équipe',
          'Assignation des prestations par membre',
          'Multi-lieux (jusqu\'à 10 adresses)',
          'Page publique d\'équipe professionnelle',
          'Tout le plan Pro inclus',
        ],
      };

      const planDisplayName = plan === 'team' ? 'Studio' : 'Pro';
      const planFeatures = PLAN_FEATURES[planDisplayName] || PLAN_FEATURES.Pro;

      sendWelcomeEmail({
        providerEmail,
        providerName: providerDisplayName,
        planName: planDisplayName,
        planFeatures,
      }).catch((err) => console.error('[STRIPE-WEBHOOK] Welcome email error:', err));
    }
  } catch (welcomeErr) {
    console.error('[STRIPE-WEBHOOK] Welcome email error:', welcomeErr);
  }
}

async function handleInvoicePaid(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  invoice: Stripe.Invoice,
) {
  console.log('[STRIPE-WEBHOOK] invoice.paid');

  // invoice.subscription / invoice.customer can be strings OR expanded objects
  const subscriptionId = extractId((invoice as any).subscription);
  const customerId = extractId(invoice.customer as any);

  console.log(`[STRIPE-WEBHOOK] subscriptionId: ${subscriptionId} (raw type: ${typeof (invoice as any).subscription})`);
  console.log(`[STRIPE-WEBHOOK] customerId: ${customerId}`);

  if (!subscriptionId) {
    console.error('[STRIPE-WEBHOOK] Missing subscriptionId in invoice');
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  console.log(`[STRIPE-WEBHOOK] Stripe subscription status: ${stripeSubscription.status}`);

  const providerId = stripeSubscription.metadata?.providerId;
  if (!providerId) {
    console.error('[STRIPE-WEBHOOK] No providerId in subscription metadata');
    return;
  }

  console.log(`[STRIPE-WEBHOOK] providerId: ${providerId}`);

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    console.warn(`[STRIPE-WEBHOOK] Provider ${providerId} not found in Firestore, skipping`);
    return;
  }

  const rawEnd = getSubscriptionPeriodEnd(stripeSubscription);
  const periodEnd = rawEnd ? new Date(rawEnd * 1000) : null;
  console.log(`[STRIPE-WEBHOOK] periodEnd: ${periodEnd?.toISOString() ?? 'null'}`);

  // Determine validUntil: take the latest between existing validUntil and Stripe periodEnd
  const existingData = providerDoc.data();
  const existingValidUntil = existingData?.subscription?.validUntil?.toDate?.() ?? null;
  let newValidUntil = periodEnd;
  if (existingValidUntil && periodEnd) {
    newValidUntil = existingValidUntil > periodEnd ? existingValidUntil : periodEnd;
  } else if (existingValidUntil && !periodEnd) {
    newValidUntil = existingValidUntil;
  }

  const invoiceUpdateData: Record<string, any> = {
    'subscription.status': 'active',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (periodEnd) {
    invoiceUpdateData['subscription.currentPeriodEnd'] = periodEnd;
  }
  if (newValidUntil) {
    invoiceUpdateData['subscription.validUntil'] = newValidUntil;
  }

  await providerRef.update(invoiceUpdateData);

  console.log(`[STRIPE-WEBHOOK] Provider ${providerId} subscription renewed (validUntil: ${newValidUntil?.toISOString() ?? 'null'})`);

  // Affiliate commission on recurring payment
  try {
    const providerData = providerDoc.data();
    const affId = providerData?.affiliateId || stripeSubscription.metadata?.affiliateId;
    const affCode = providerData?.affiliateCode || stripeSubscription.metadata?.affiliateCode;
    const amountPaid = invoice.amount_paid; // actual amount paid (after discount)

    if (affId && amountPaid && amountPaid > 0) {
      const affiliateDoc = await db.collection('affiliates').doc(affId).get();
      if (affiliateDoc.exists) {
        const affiliate = affiliateDoc.data()!;
        if (affiliate.isActive && affiliate.stripeAccountId && affiliate.stripeAccountStatus === 'active') {
          const commissionCents = Math.round(amountPaid * (affiliate.commission / 100));
          if (commissionCents > 0) {
            // Get charge from invoice
            const chargeId = extractId((invoice as any).charge);
            if (chargeId) {
              const transfer = await stripe.transfers.create({
                amount: commissionCents,
                currency: 'eur',
                destination: affiliate.stripeAccountId,
                source_transaction: chargeId,
                metadata: {
                  affiliateCode: affCode || '',
                  affiliateId: affId,
                  providerId,
                  source: 'invoice',
                },
              });

              await db.collection('affiliates').doc(affId).update({
                'stats.totalRevenue': (affiliate.stats?.totalRevenue || 0) + amountPaid,
                'stats.totalCommission': (affiliate.stats?.totalCommission || 0) + commissionCents,
                updatedAt: new Date(),
              });

              await db.collection('_affiliateLogs').add({
                type: 'payment',
                affiliateId: affId,
                affiliateCode: affCode,
                providerId,
                paymentIntentId: extractId((invoice as any).payment_intent),
                transferId: transfer.id,
                amount: amountPaid,
                commission: commissionCents,
                commissionRate: affiliate.commission,
                source: 'invoice',
                createdAt: new Date(),
              });

              console.log(`[STRIPE-WEBHOOK] Affiliate recurring transfer: ${commissionCents} cents to ${affiliate.code} (${transfer.id})`);
            }
          }
        }
      }
    }
  } catch (affiliateErr) {
    console.error('[STRIPE-WEBHOOK] Affiliate recurring transfer error (non-blocking):', affiliateErr);
  }
}

async function handleSubscriptionUpdated(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  subscription: Stripe.Subscription,
) {
  console.log('[STRIPE-WEBHOOK] customer.subscription.updated');

  const providerId = subscription.metadata?.providerId;
  if (!providerId) {
    console.error('[STRIPE-WEBHOOK] No providerId in subscription metadata');
    return;
  }

  // Retrieve the FULL subscription from Stripe API
  const fullSub = await stripe.subscriptions.retrieve(subscription.id);

  console.log(`[STRIPE-WEBHOOK] status: ${fullSub.status}, cancel_at_period_end: ${fullSub.cancel_at_period_end}`);

  // Map Stripe status to our internal status
  type OurStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete';
  const statusMap: Record<string, OurStatus> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'cancelled', // Stripe uses "canceled" (1 l), we use "cancelled" (2 l)
    incomplete: 'incomplete',
    incomplete_expired: 'cancelled',
    unpaid: 'past_due',
    paused: 'active', // Treat paused as active for simplicity
  };

  const status: OurStatus = statusMap[fullSub.status] || 'active';

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    console.warn(`[STRIPE-WEBHOOK] Provider ${providerId} not found in Firestore, skipping`);
    return;
  }

  const rawEnd = getSubscriptionPeriodEnd(fullSub);
  const periodEnd = rawEnd ? new Date(rawEnd * 1000) : null;
  console.log(`[STRIPE-WEBHOOK] periodEnd: ${periodEnd?.toISOString() ?? 'null'}`);

  // Determine validUntil: take the latest between existing validUntil and Stripe periodEnd
  const existingData = providerDoc.data();
  const existingValidUntil = existingData?.subscription?.validUntil?.toDate?.() ?? null;
  let newValidUntil = periodEnd;
  if (existingValidUntil && periodEnd) {
    newValidUntil = existingValidUntil > periodEnd ? existingValidUntil : periodEnd;
  } else if (existingValidUntil && !periodEnd) {
    newValidUntil = existingValidUntil;
  }

  // Determine the plan from subscription metadata
  const plan = fullSub.metadata?.plan;

  // Count active members for the provider
  const membersSnapshot = await db
    .collection('providers')
    .doc(providerId)
    .collection('members')
    .where('isActive', '==', true)
    .get();
  const activeMemberCount = membersSnapshot.size;

  // Detect whether the deposits add-on (+5€/mo) is on this subscription.
  // We tolerate a missing/unconfigured product (returns false) so envs
  // without the add-on configured don't blow up here.
  let depositsAddonActive = false;
  try {
    const addonPriceId = await getDepositsAddonPriceId(stripe);
    depositsAddonActive = fullSub.items.data.some(
      (it) => it.price.id === addonPriceId
    );
  } catch {
    // Add-on product not in Stripe yet — feature effectively disabled
  }

  const updateData: Record<string, any> = {
    'subscription.status': status,
    'subscription.cancelAtPeriodEnd': fullSub.cancel_at_period_end,
    'subscription.memberCount': activeMemberCount,
    depositsAddonActive,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (periodEnd) {
    updateData['subscription.currentPeriodEnd'] = periodEnd;
  }
  if (newValidUntil) {
    updateData['subscription.validUntil'] = newValidUntil;
  }

  if (plan) {
    updateData.plan = plan;
    updateData['subscription.plan'] = plan;
  }

  await providerRef.update(updateData);

  console.log(
    `[STRIPE-WEBHOOK] Provider ${providerId} subscription updated: ${status}, cancelAtPeriodEnd: ${fullSub.cancel_at_period_end}, periodEnd: ${periodEnd?.toISOString() ?? 'null'}`,
  );

  // Detect plan change and notify the user. Runs AFTER the Firestore update
  // so we don't hold up the main flow; failures are logged but non-blocking.
  const previousPlan = existingData?.plan as string | undefined;
  if (plan && previousPlan && plan !== previousPlan && plan !== 'trial') {
    try {
      await sendPlanChangeEmail({
        stripe,
        subscriptionId: fullSub.id,
        provider: existingData,
        previousPlan,
        newPlan: plan,
      });
    } catch (err) {
      console.error('[STRIPE-WEBHOOK] plan-change email failed (non-blocking):', err);
    }
  }
}

const PLAN_LABELS: Record<string, string> = {
  solo: 'Pro',
  team: 'Studio',
  test: 'Test',
  trial: 'Essai gratuit',
};

/**
 * Send the plan-change confirmation email. Pulls the prorata breakdown from
 * the upcoming invoice preview — that's the source of truth for what Stripe
 * will actually bill on the next invoice.
 */
async function sendPlanChangeEmail(args: {
  stripe: Stripe;
  subscriptionId: string;
  provider: FirebaseFirestore.DocumentData | undefined;
  previousPlan: string;
  newPlan: string;
}): Promise<void> {
  const { stripe, subscriptionId, provider, previousPlan, newPlan } = args;

  const email = (provider?.email as string | undefined) ?? null;
  const name = (provider?.businessName as string | undefined)
    ?? (provider?.ownerName as string | undefined)
    ?? 'cher partenaire';

  if (!email) {
    console.warn('[STRIPE-WEBHOOK] Provider has no email, skipping plan-change notification');
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[STRIPE-WEBHOOK] RESEND_API_KEY not set, skipping plan-change notification');
    return;
  }

  // Fetch the upcoming invoice — its prorata lines tell us what was just
  // queued for the next billing cycle.
  const preview = await stripe.invoices.createPreview({ subscription: subscriptionId });
  let creditCents = 0;
  let chargeCents = 0;
  for (const line of preview.lines.data) {
    const amount = line.amount ?? 0;
    const parent = line.parent;
    const isProration =
      parent?.type === 'invoice_item_details'
        ? parent.invoice_item_details?.proration === true
        : parent?.type === 'subscription_item_details'
          ? parent.subscription_item_details?.proration === true
          : false;
    if (isProration) {
      if (amount < 0) creditCents += amount;
      else chargeCents += amount;
    }
  }
  const netCents = creditCents + chargeCents;

  const periodEndSec =
    (preview as unknown as { period_end?: number }).period_end ?? null;
  const nextInvoiceDate = periodEndSec
    ? new Date(periodEndSec * 1000).toISOString()
    : null;

  const { subject, html } = generatePlanChangeEmail({
    name,
    previousPlanLabel: PLAN_LABELS[previousPlan] ?? previousPlan,
    newPlanLabel: PLAN_LABELS[newPlan] ?? newPlan,
    nextInvoiceDate,
    netCents,
    creditCents,
    chargeCents,
    currency: preview.currency,
  });

  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from: 'Opatam <noreply@kamerleontech.com>',
    to: email,
    subject,
    html,
  });
  if (error) {
    console.error('[STRIPE-WEBHOOK] Resend plan-change email error:', error);
  } else {
    console.log(`[STRIPE-WEBHOOK] Plan-change email sent to ${email} (${previousPlan} → ${newPlan})`);
  }
}

async function handleSubscriptionDeleted(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  subscription: Stripe.Subscription,
) {
  console.log('[STRIPE-WEBHOOK] customer.subscription.deleted');

  const providerId = subscription.metadata?.providerId;
  if (!providerId) {
    console.error('[STRIPE-WEBHOOK] No providerId in subscription metadata');
    return;
  }

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    console.warn(`[STRIPE-WEBHOOK] Provider ${providerId} not found in Firestore, skipping`);
    return;
  }

  await providerRef.update({
    'subscription.status': 'cancelled',
    'subscription.cancelAtPeriodEnd': false,
    isPublished: false, // Unpublish the provider profile
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[STRIPE-WEBHOOK] Provider ${providerId} subscription deleted - profile unpublished`);
}

// ---------------------------------------------------------------------------
// Welcome Email Helper (standalone — cannot import from functions package)
// ---------------------------------------------------------------------------

async function sendWelcomeEmail(data: {
  providerEmail: string;
  providerName: string;
  planName: string;
  planFeatures: string[];
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[STRIPE-WEBHOOK] RESEND_API_KEY not set, skipping welcome email');
    return;
  }

  const resend = new Resend(resendApiKey);
  const isPro = data.planName === 'Pro';
  const themeColor = isPro ? '#3b82f6' : '#8b5cf6';
  const themeBg = isPro ? '#eff6ff' : '#f5f3ff';
  const themeBorder = isPro ? '#bfdbfe' : '#c4b5fd';
  const tierLabel = isPro ? 'Indépendant' : 'Équipe';

  const featuresHtml = data.planFeatures
    .map(f => `<tr><td style="padding: 6px 0; font-size: 14px; color: #18181b;"><span style="color: #16a34a; font-weight: bold; margin-right: 8px;">&#10003;</span> ${f}</td></tr>`)
    .join('');

  const featuresText = data.planFeatures.map(f => `- ${f}`).join('\n');

  const appName = 'Opatam';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  const logoUrl = 'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.appspot.com/o/assets%2Flogos%2Flogo-email.png?alt=media';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${logoUrl}" alt="${appName}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.providerName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Merci d'avoir choisi <strong>${appName}</strong> ! Votre abonnement <strong style="color: ${themeColor};">${data.planName}</strong> est désormais actif.</p>
                  <div style="background-color: ${themeBg}; border: 1px solid ${themeBorder}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: ${themeColor}; text-transform: uppercase; letter-spacing: 0.5px;">Votre plan</p>
                    <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #18181b;">${data.planName} <span style="font-size: 14px; font-weight: 400; color: #71717a;">&mdash; ${tierLabel}</span></p>
                    <table style="width: 100%; border-collapse: collapse;">
                      ${featuresHtml}
                    </table>
                  </div>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">Tout est prêt pour accueillir vos premiers clients. Configurez vos disponibilités, ajoutez vos prestations et partagez votre page de réservation.</p>
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${appUrl}/pro/calendrier" style="display: inline-block; padding: 14px 32px; background-color: ${themeColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Accéder à mon espace</a></td></tr></table>
                  <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;"><a href="${appUrl}/pro/parametres?tab=abonnement" style="color: ${themeColor}; text-decoration: underline;">Gérer mon abonnement</a></p>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>L'équipe ${appName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${appName}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Bonjour ${data.providerName},

Merci d'avoir choisi ${appName} ! Votre abonnement ${data.planName} est désormais actif.

Votre plan : ${data.planName} — ${tierLabel}
${featuresText}

Tout est prêt pour accueillir vos premiers clients.

Accéder à mon espace : ${appUrl}/pro/calendrier
Gérer mon abonnement : ${appUrl}/pro/parametres?tab=abonnement

À bientôt,
L'équipe ${appName}
  `.trim();

  const { error } = await resend.emails.send({
    from: 'Opatam <noreply@kamerleontech.com>',
    to: data.providerEmail,
    subject: `Bienvenue chez ${appName} — Plan ${data.planName} activé !`,
    html,
    text,
  });

  if (error) {
    console.error('[STRIPE-WEBHOOK] Resend welcome email error:', error);
  } else {
    console.log(`[STRIPE-WEBHOOK] Welcome email sent to ${data.providerEmail}`);
  }
}

// ---------------------------------------------------------------------------
// Connect account updates (affiliate onboarding status)
// ---------------------------------------------------------------------------

/**
 * Fires whenever a Stripe Connect account changes — typically when an
 * affiliate finishes or updates their onboarding. We look up the matching
 * affiliate by stripeAccountId and sync stripeAccountStatus in Firestore.
 *
 * This is the reliable counterpart to the on-demand /api/affiliates/sync-status
 * call the dashboard makes: even if the affiliate closes the tab before
 * returning to the app, the webhook still updates their record.
 */
async function handleConnectAccountUpdated(
  db: FirebaseFirestore.Firestore,
  account: Stripe.Account,
) {
  console.log(`[STRIPE-WEBHOOK] account.updated: ${account.id}`);

  // Connect accounts come from two collections in this app:
  //  - affiliates/* (commissions sub-merchants — only need 'transfers')
  //  - providers/* (deposits sub-merchants — need 'card_payments' + 'transfers')
  // We try both and apply the right status semantics for each.

  const affiliateSnap = await db
    .collection('affiliates')
    .where('stripeAccountId', '==', account.id)
    .limit(1)
    .get();

  if (!affiliateSnap.empty) {
    const docRef = affiliateSnap.docs[0].ref;
    const data = affiliateSnap.docs[0].data();
    const transfersStatus = account.capabilities?.transfers || 'not_requested';
    const newStatus: 'active' | 'pending' | 'restricted' =
      transfersStatus === 'active'
        ? 'active'
        : transfersStatus === 'pending'
        ? 'pending'
        : 'restricted';

    const previousStatus = data.stripeAccountStatus as string | undefined;
    if (previousStatus === newStatus) {
      console.log(
        `[STRIPE-WEBHOOK] affiliate account ${account.id}: status unchanged (${newStatus})`,
      );
      return;
    }
    await docRef.update({ stripeAccountStatus: newStatus, updatedAt: new Date() });
    console.log(
      `[STRIPE-WEBHOOK] affiliate ${affiliateSnap.docs[0].id}: ${previousStatus} → ${newStatus}`,
    );
    return;
  }

  // Provider Connect account (deposits add-on)
  const providerSnap = await db
    .collection('providers')
    .where('stripeConnectAccountId', '==', account.id)
    .limit(1)
    .get();

  if (!providerSnap.empty) {
    const docRef = providerSnap.docs[0].ref;
    const data = providerSnap.docs[0].data();

    const cardCap = account.capabilities?.card_payments ?? 'inactive';
    const transfersCap = account.capabilities?.transfers ?? 'inactive';
    const newStatus: 'active' | 'pending' | 'restricted' =
      cardCap === 'active' && transfersCap === 'active'
        ? 'active'
        : cardCap === 'pending' || transfersCap === 'pending'
        ? 'pending'
        : 'restricted';

    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;

    const previousStatus = data.stripeConnectStatus as string | undefined;
    if (
      previousStatus === newStatus &&
      data.stripeConnectChargesEnabled === chargesEnabled &&
      data.stripeConnectPayoutsEnabled === payoutsEnabled
    ) {
      console.log(
        `[STRIPE-WEBHOOK] provider account ${account.id}: status unchanged`,
      );
      return;
    }

    await docRef.update({
      stripeConnectStatus: newStatus,
      stripeConnectChargesEnabled: chargesEnabled,
      stripeConnectPayoutsEnabled: payoutsEnabled,
      updatedAt: new Date(),
    });
    console.log(
      `[STRIPE-WEBHOOK] provider ${providerSnap.docs[0].id}: ${previousStatus} → ${newStatus} (charges=${chargesEnabled}, payouts=${payoutsEnabled})`,
    );
    return;
  }

  console.log(
    `[STRIPE-WEBHOOK] No affiliate or provider found for account ${account.id}`,
  );
}

// ────────────────────────────────────────────────────────────────────────
// Booking deposit checkout (acomptes feature)
// ────────────────────────────────────────────────────────────────────────

/**
 * checkout.session.completed for a booking deposit.
 *
 * Flips the booking from `pending_payment` → `confirmed`, marks the
 * deposit as paid, stores the resulting payment_intent so we can refund
 * it later. Idempotent — replaying the event is a no-op once paid.
 */
async function handleDepositCheckoutCompleted(
  db: FirebaseFirestore.Firestore,
  session: Stripe.Checkout.Session,
) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  console.log(`[STRIPE-WEBHOOK] booking deposit completed: ${bookingId}`);

  const bookingRef = db.collection('bookings').doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists) {
    console.warn(`[STRIPE-WEBHOOK] booking ${bookingId} not found`);
    return;
  }
  const booking = snap.data()!;

  // Idempotency — bail if already confirmed/paid
  if (booking.status === 'confirmed' && booking.deposit?.status === 'paid') {
    console.log(`[STRIPE-WEBHOOK] booking ${bookingId} already paid, skipping`);
    return;
  }

  // Pull the payment_intent id (may be expanded or just an ID)
  const paymentIntentId = extractId(session.payment_intent);

  await bookingRef.update({
    status: 'confirmed',
    'deposit.status': 'paid',
    'deposit.paidAt': new Date(),
    'deposit.paymentIntentId': paymentIntentId,
    'deposit.checkoutSessionId': session.id,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    `[STRIPE-WEBHOOK] booking ${bookingId}: pending_payment → confirmed (intent ${paymentIntentId})`,
  );
}

/**
 * charge.refunded — fires whenever a charge on a connected account is
 * refunded (in part or in full). We use it to keep `booking.deposit`
 * in sync with Stripe when the pro refunds directly via the Stripe
 * Dashboard rather than going through the in-app cancel flow.
 *
 * Idempotent: the in-app refund flow already updates Firestore before
 * Stripe even fires this event, and the early-return on
 * `deposit.status === 'refunded'` makes replays a no-op.
 */
async function handleChargeRefunded(
  db: FirebaseFirestore.Firestore,
  charge: Stripe.Charge,
) {
  const paymentIntentId = extractId(charge.payment_intent as any);
  if (!paymentIntentId) {
    console.log('[STRIPE-WEBHOOK] charge.refunded with no payment_intent — skipping');
    return;
  }

  // The PaymentIntent here is on a connected account (deposits flow).
  // Find the booking whose deposit references it.
  const snap = await db
    .collection('bookings')
    .where('deposit.paymentIntentId', '==', paymentIntentId)
    .limit(1)
    .get();

  if (snap.empty) {
    console.log(
      `[STRIPE-WEBHOOK] charge.refunded: no booking for payment_intent ${paymentIntentId}`,
    );
    return;
  }

  const doc = snap.docs[0];
  const data = doc.data();
  if (data.deposit?.status === 'refunded') {
    console.log(
      `[STRIPE-WEBHOOK] booking ${doc.id} already marked refunded — no-op`,
    );
    return;
  }

  // Pick the latest refund id off the charge for record-keeping.
  const refundId =
    charge.refunds?.data?.[0]?.id ?? null;

  await doc.ref.update({
    'deposit.status': 'refunded',
    'deposit.refundedAt': new Date(),
    'deposit.refundId': refundId,
    // Conservatively credit the dashboard refund to the provider — the
    // in-app flow would have set this already if it had run.
    'deposit.refundedBy': 'provider',
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    `[STRIPE-WEBHOOK] booking ${doc.id}: deposit refunded via Stripe Dashboard (refund ${refundId ?? 'unknown'})`,
  );
}

/**
 * checkout.session.expired for a booking deposit.
 *
 * The client started Checkout, walked away, and Stripe gave up. We
 * delete the booking entirely so the slot is freed for another client.
 * Defensive: only acts if the booking is still `pending_payment` —
 * never touches an already-confirmed booking.
 */
async function handleDepositCheckoutExpired(
  db: FirebaseFirestore.Firestore,
  session: Stripe.Checkout.Session,
) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  console.log(`[STRIPE-WEBHOOK] booking deposit expired: ${bookingId}`);

  const bookingRef = db.collection('bookings').doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists) return;

  const booking = snap.data()!;
  if (booking.status !== 'pending_payment') {
    console.log(
      `[STRIPE-WEBHOOK] booking ${bookingId} is ${booking.status} — not deleting`,
    );
    return;
  }

  await bookingRef.delete();
  console.log(
    `[STRIPE-WEBHOOK] booking ${bookingId} deleted (deposit checkout expired)`,
  );
}

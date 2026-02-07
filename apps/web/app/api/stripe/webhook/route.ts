import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Stripe Webhook Handler
// ---------------------------------------------------------------------------
// This route receives raw POST bodies from Stripe, verifies the signature,
// and dispatches to the appropriate handler. It ALWAYS returns 200 to avoid
// Stripe retrying events endlessly — errors are logged for investigation.
// ---------------------------------------------------------------------------

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

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[STRIPE-WEBHOOK] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[STRIPE-WEBHOOK] Event type: ${event.type}, ID: ${event.id}`);

  const db = getAdminFirestore();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(db, stripe, session);
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
      default:
        console.log(`[STRIPE-WEBHOOK] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[STRIPE-WEBHOOK] Error handling ${event.type}:`, String(error));
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

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  console.log(`[STRIPE-WEBHOOK] providerId: ${providerId}`);
  console.log(`[STRIPE-WEBHOOK] subscriptionId: ${subscriptionId}`);
  console.log(`[STRIPE-WEBHOOK] customerId: ${customerId}`);

  if (!subscriptionId || !customerId) {
    console.error('[STRIPE-WEBHOOK] Missing subscriptionId or customerId in session');
    return;
  }

  // Retrieve the Stripe subscription for detailed info
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  console.log(`[STRIPE-WEBHOOK] Stripe subscription status: ${stripeSubscription.status}`);

  // Determine the plan from subscription metadata (set during checkout)
  const plan = stripeSubscription.metadata?.plan || 'solo';
  console.log(`[STRIPE-WEBHOOK] Plan from metadata: ${stripeSubscription.metadata?.plan ?? 'MISSING'} → using: ${plan}`);

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    console.warn(`[STRIPE-WEBHOOK] Provider ${providerId} not found in Firestore, skipping`);
    return;
  }

  const rawEnd = getSubscriptionPeriodEnd(stripeSubscription);
  const periodEnd = rawEnd ? new Date(rawEnd * 1000) : null;
  console.log(`[STRIPE-WEBHOOK] periodEnd: ${periodEnd?.toISOString() ?? 'null'}`);

  // Determine validUntil: take the latest between existing validUntil (trial) and Stripe periodEnd
  const existingData = providerDoc.data();
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
}

async function handleInvoicePaid(
  db: FirebaseFirestore.Firestore,
  stripe: Stripe,
  invoice: Stripe.Invoice,
) {
  console.log('[STRIPE-WEBHOOK] invoice.paid');

  // In Stripe SDK v20+ (API 2025-03-31), invoice.subscription type changed.
  // Cast through any for compatibility.
  const subscriptionId = (invoice as any).subscription as string;
  const customerId = invoice.customer as string;

  console.log(`[STRIPE-WEBHOOK] subscriptionId: ${subscriptionId}`);
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

  const updateData: Record<string, any> = {
    'subscription.status': status,
    'subscription.cancelAtPeriodEnd': fullSub.cancel_at_period_end,
    'subscription.memberCount': activeMemberCount,
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

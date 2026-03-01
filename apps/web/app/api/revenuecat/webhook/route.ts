import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// RevenueCat Webhook Handler
// ---------------------------------------------------------------------------
// Receives webhook events from RevenueCat for Apple IAP & Google Play
// subscriptions. Updates the same Provider.subscription fields in Firestore
// as the Stripe webhook, ensuring a unified subscription model.
//
// RevenueCat event types:
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
// ---------------------------------------------------------------------------

// RevenueCat webhook event types we handle
type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE_DETECTED'
  | 'BILLING_ISSUE_RESOLVED'
  | 'PRODUCT_CHANGE'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TRANSFER';

interface RevenueCatEvent {
  type: RevenueCatEventType;
  app_user_id: string;
  aliases: string[];
  product_id: string;
  entitlement_ids: string[] | null;
  period_type: 'TRIAL' | 'INTRO' | 'NORMAL';
  purchased_at_ms: number;
  expiration_at_ms: number | null;
  store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
  environment: 'SANDBOX' | 'PRODUCTION';
  is_family_share: boolean;
  country_code: string;
  currency: string;
  price_in_purchased_currency: number;
  subscriber_attributes: Record<string, { value: string; updated_at_ms: number }>;
  transaction_id: string;
  original_transaction_id: string;
  // Additional fields we may use
  cancel_reason?: string;
  expiration_reason?: string;
  new_product_id?: string;
}

interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}

/**
 * Map a RevenueCat product_id to our internal plan.
 * Product IDs: opatam_solo_monthly, opatam_solo_yearly, opatam_team_monthly, opatam_team_yearly
 */
function getplanFromProductId(productId: string): 'solo' | 'team' | null {
  if (productId.includes('solo')) return 'solo';
  if (productId.includes('team')) return 'team';
  return null;
}

/**
 * Map RevenueCat store to our PaymentSource type.
 */
function getPaymentSource(store: string): 'apple' | 'google' | 'stripe' {
  switch (store) {
    case 'APP_STORE': return 'apple';
    case 'PLAY_STORE': return 'google';
    case 'STRIPE': return 'stripe';
    default: return 'apple';
  }
}

/**
 * Extract the providerId from RevenueCat subscriber attributes or app_user_id.
 * We set the providerId as subscriber attribute AND as the app_user_id when
 * identifying the user in the RevenueCat SDK.
 */
function getProviderId(event: RevenueCatEvent): string | null {
  // 1. Check subscriber attributes (most reliable)
  const providerIdAttr = event.subscriber_attributes?.providerId?.value
    || event.subscriber_attributes?.provider_id?.value;
  if (providerIdAttr) return providerIdAttr;

  // 2. Fall back to app_user_id (we set this to providerId in the SDK)
  if (event.app_user_id && !event.app_user_id.startsWith('$RCAnonymous')) {
    return event.app_user_id;
  }

  // 3. Check aliases
  const nonAnonymousAlias = event.aliases?.find(a => !a.startsWith('$RCAnonymous'));
  if (nonAnonymousAlias) return nonAnonymousAlias;

  return null;
}

/**
 * Log a webhook event to Firestore for real-time monitoring on the test page.
 * Collection: _webhookLogs (prefixed with _ to indicate internal/dev use)
 */
async function logWebhookEvent(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string | null,
  status: 'received' | 'processed' | 'error',
  error?: string,
) {
  try {
    await db.collection('_webhookLogs').add({
      source: 'revenuecat',
      eventType: event.type,
      productId: event.product_id,
      store: event.store,
      environment: event.environment,
      providerId,
      appUserId: event.app_user_id,
      status,
      error: error || null,
      payload: {
        period_type: event.period_type,
        expiration_at_ms: event.expiration_at_ms,
        transaction_id: event.transaction_id,
        price: event.price_in_purchased_currency,
        currency: event.currency,
        country_code: event.country_code,
        entitlement_ids: event.entitlement_ids,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (logErr) {
    console.error('[RC-WEBHOOK] Failed to write log:', logErr);
  }
}

export async function POST(request: NextRequest) {
  console.log('[RC-WEBHOOK] ========== EVENT RECEIVED ==========');

  // Verify authorization header
  const authHeader = request.headers.get('authorization');
  const expectedAuth = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
    console.error('[RC-WEBHOOK] Invalid authorization header');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: RevenueCatWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    console.error('[RC-WEBHOOK] Invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event } = payload;
  console.log(`[RC-WEBHOOK] Event type: ${event.type}, product: ${event.product_id}, store: ${event.store}, env: ${event.environment}`);

  const db = getAdminFirestore();

  const providerId = getProviderId(event);
  if (!providerId) {
    console.error('[RC-WEBHOOK] Could not determine providerId from event', {
      app_user_id: event.app_user_id,
      aliases: event.aliases,
      attributes: Object.keys(event.subscriber_attributes || {}),
    });
    await logWebhookEvent(db, event, null, 'error', 'No providerId found');
    return NextResponse.json({ error: 'No providerId' }, { status: 400 });
  }

  console.log(`[RC-WEBHOOK] providerId: ${providerId}`);

  // Log the received event
  await logWebhookEvent(db, event, providerId, 'received');

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
        await handleInitialPurchase(db, event, providerId);
        break;
      case 'RENEWAL':
        await handleRenewal(db, event, providerId);
        break;
      case 'CANCELLATION':
        await handleCancellation(db, event, providerId);
        break;
      case 'UNCANCELLATION':
        await handleUncancellation(db, event, providerId);
        break;
      case 'EXPIRATION':
        await handleExpiration(db, event, providerId);
        break;
      case 'BILLING_ISSUE_DETECTED':
        await handleBillingIssue(db, event, providerId);
        break;
      case 'BILLING_ISSUE_RESOLVED':
        await handleBillingResolved(db, event, providerId);
        break;
      case 'PRODUCT_CHANGE':
        await handleProductChange(db, event, providerId);
        break;
      case 'SUBSCRIPTION_EXTENDED':
        await handleRenewal(db, event, providerId); // Same logic as renewal
        break;
      default:
        console.log(`[RC-WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Log successful processing
    await logWebhookEvent(db, event, providerId, 'processed');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
    console.error(`[RC-WEBHOOK] Error handling ${event.type}:`, errorMsg);
    await logWebhookEvent(db, event, providerId, 'error', errorMsg);
    // Return 200 anyway to prevent RevenueCat from retrying in a loop
  }

  console.log('[RC-WEBHOOK] ========== EVENT PROCESSED ==========');
  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

async function handleInitialPurchase(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log('[RC-WEBHOOK] INITIAL_PURCHASE');

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    console.warn(`[RC-WEBHOOK] Provider ${providerId} not found in Firestore`);
    return;
  }

  const existingData = providerDoc.data();

  // Guard: don't overwrite an active Stripe subscription
  if (existingData?.subscription?.status === 'active' && existingData?.subscription?.paymentSource === 'stripe') {
    console.warn(`[RC-WEBHOOK] Provider ${providerId} already has active Stripe subscription, skipping IAP activation`);
    return;
  }

  const plan = getplanFromProductId(event.product_id);
  if (!plan) {
    console.error(`[RC-WEBHOOK] Unknown product_id: ${event.product_id}`);
    return;
  }

  const paymentSource = getPaymentSource(event.store);
  const expirationDate = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const status = event.period_type === 'TRIAL' ? 'trialing' : 'active';

  // Calculate validUntil: max between existing and new expiration
  const existingValidUntil = existingData?.subscription?.validUntil?.toDate?.() ?? null;
  let newValidUntil = expirationDate;
  if (existingValidUntil && expirationDate) {
    newValidUntil = existingValidUntil > expirationDate ? existingValidUntil : expirationDate;
  } else if (existingValidUntil && !expirationDate) {
    newValidUntil = existingValidUntil;
  }

  // Count active members
  const membersSnapshot = await db
    .collection('providers').doc(providerId)
    .collection('members').where('isActive', '==', true)
    .get();

  const updateData: Record<string, any> = {
    plan,
    'subscription.plan': plan,
    'subscription.status': status,
    'subscription.paymentSource': paymentSource,
    'subscription.revenuecatAppUserId': event.app_user_id,
    'subscription.cancelAtPeriodEnd': false,
    'subscription.memberCount': membersSnapshot.size,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (newValidUntil) {
    updateData['subscription.validUntil'] = newValidUntil;
  }
  if (expirationDate) {
    updateData['subscription.currentPeriodEnd'] = expirationDate;
  }

  await providerRef.update(updateData);

  console.log(`[RC-WEBHOOK] Provider ${providerId} subscription activated via ${paymentSource}: plan=${plan}, status=${status}, expires=${expirationDate?.toISOString() ?? 'null'}`);
}

async function handleRenewal(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log(`[RC-WEBHOOK] ${event.type}`);

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) {
    console.warn(`[RC-WEBHOOK] Provider ${providerId} not found`);
    return;
  }

  const existingData = providerDoc.data();
  const expirationDate = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  // Calculate validUntil
  const existingValidUntil = existingData?.subscription?.validUntil?.toDate?.() ?? null;
  let newValidUntil = expirationDate;
  if (existingValidUntil && expirationDate) {
    newValidUntil = existingValidUntil > expirationDate ? existingValidUntil : expirationDate;
  } else if (existingValidUntil && !expirationDate) {
    newValidUntil = existingValidUntil;
  }

  const updateData: Record<string, any> = {
    'subscription.status': 'active',
    'subscription.cancelAtPeriodEnd': false,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (expirationDate) {
    updateData['subscription.currentPeriodEnd'] = expirationDate;
  }
  if (newValidUntil) {
    updateData['subscription.validUntil'] = newValidUntil;
  }

  await providerRef.update(updateData);

  console.log(`[RC-WEBHOOK] Provider ${providerId} subscription renewed, expires=${expirationDate?.toISOString() ?? 'null'}`);
}

async function handleCancellation(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log('[RC-WEBHOOK] CANCELLATION');

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) return;

  // Cancellation means the user cancelled but still has access until period end
  // (similar to Stripe cancel_at_period_end = true)
  const updateData: Record<string, any> = {
    'subscription.cancelAtPeriodEnd': true,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // If expiration is in the past, the subscription is effectively expired
  if (event.expiration_at_ms && event.expiration_at_ms < Date.now()) {
    updateData['subscription.status'] = 'cancelled';
    updateData.isPublished = false;
  }

  await providerRef.update(updateData);

  console.log(`[RC-WEBHOOK] Provider ${providerId} subscription cancelled (cancelAtPeriodEnd: true)`);
}

async function handleUncancellation(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log('[RC-WEBHOOK] UNCANCELLATION');

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) return;

  await providerRef.update({
    'subscription.cancelAtPeriodEnd': false,
    'subscription.status': 'active',
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[RC-WEBHOOK] Provider ${providerId} subscription uncancelled`);
}

async function handleExpiration(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log('[RC-WEBHOOK] EXPIRATION');

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) return;

  await providerRef.update({
    'subscription.status': 'cancelled',
    'subscription.cancelAtPeriodEnd': false,
    isPublished: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[RC-WEBHOOK] Provider ${providerId} subscription expired — profile unpublished`);
}

async function handleBillingIssue(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log('[RC-WEBHOOK] BILLING_ISSUE_DETECTED');

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) return;

  await providerRef.update({
    'subscription.status': 'past_due',
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[RC-WEBHOOK] Provider ${providerId} billing issue detected`);
}

async function handleBillingResolved(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log('[RC-WEBHOOK] BILLING_ISSUE_RESOLVED');

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) return;

  const expirationDate = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  const updateData: Record<string, any> = {
    'subscription.status': 'active',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (expirationDate) {
    updateData['subscription.currentPeriodEnd'] = expirationDate;
    updateData['subscription.validUntil'] = expirationDate;
  }

  await providerRef.update(updateData);

  console.log(`[RC-WEBHOOK] Provider ${providerId} billing issue resolved`);
}

async function handleProductChange(
  db: FirebaseFirestore.Firestore,
  event: RevenueCatEvent,
  providerId: string,
) {
  console.log('[RC-WEBHOOK] PRODUCT_CHANGE');

  const newProductId = event.new_product_id || event.product_id;
  const newPlan = getplanFromProductId(newProductId);

  if (!newPlan) {
    console.error(`[RC-WEBHOOK] Unknown new product_id: ${newProductId}`);
    return;
  }

  const providerRef = db.collection('providers').doc(providerId);
  const providerDoc = await providerRef.get();
  if (!providerDoc.exists) return;

  const expirationDate = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  const updateData: Record<string, any> = {
    plan: newPlan,
    'subscription.plan': newPlan,
    'subscription.status': 'active',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (expirationDate) {
    updateData['subscription.currentPeriodEnd'] = expirationDate;
    updateData['subscription.validUntil'] = expirationDate;
  }

  await providerRef.update(updateData);

  console.log(`[RC-WEBHOOK] Provider ${providerId} changed plan to ${newPlan}`);
}

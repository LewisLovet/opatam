import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStripeDev } from '@/lib/stripe';

const stripe = getStripeDev();

/**
 * POST /api/dev/affiliates/simulate
 * Body: { action: 'payment' | 'refund', ... }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'payment') {
      return handlePayment(body);
    }
    if (action === 'refund') {
      return handleRefund(body);
    }

    return NextResponse.json({ error: 'Action invalide (payment ou refund)' }, { status: 400 });
  } catch (err: any) {
    console.error('[dev/affiliates/simulate] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Simulate a payment with affiliate commission transfer
 */
async function handlePayment(body: { affiliateId: string; amount: number }) {
  const { affiliateId, amount } = body;

  if (!affiliateId || !amount) {
    return NextResponse.json({ error: 'affiliateId et amount requis' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const affiliateDoc = await db.collection('affiliates').doc(affiliateId).get();
  if (!affiliateDoc.exists) {
    return NextResponse.json({ error: 'Affilié non trouvé' }, { status: 404 });
  }

  const affiliate = affiliateDoc.data()!;
  const amountCents = Math.round(amount * 100);
  const commissionCents = Math.round(amountCents * (affiliate.commission / 100));

  // Step 1: Create and confirm PaymentIntent (money goes to platform)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
    metadata: {
      affiliateCode: affiliate.code,
      affiliateId,
      simulation: 'true',
    },
  });

  // Step 2: Transfer commission to affiliate's Connect account
  const transfer = await stripe.transfers.create({
    amount: commissionCents,
    currency: 'eur',
    destination: affiliate.stripeAccountId,
    source_transaction: paymentIntent.latest_charge as string,
    metadata: {
      affiliateCode: affiliate.code,
      affiliateId,
      paymentIntentId: paymentIntent.id,
    },
  });

  // Update affiliate stats in Firestore
  await db.collection('affiliates').doc(affiliateId).update({
    'stats.totalReferrals': FieldValue.increment(1),
    'stats.totalRevenue': FieldValue.increment(amountCents),
    'stats.totalCommission': FieldValue.increment(commissionCents),
    updatedAt: new Date(),
  });

  // Log the operation
  await db.collection('_affiliateLogs').add({
    type: 'payment',
    affiliateId,
    affiliateCode: affiliate.code,
    paymentIntentId: paymentIntent.id,
    transferId: transfer.id,
    amount: amountCents,
    commission: commissionCents,
    commissionRate: affiliate.commission,
    status: paymentIntent.status,
    refunded: false,
    createdAt: new Date(),
  });

  return NextResponse.json({
    success: true,
    paymentIntent: {
      id: paymentIntent.id,
      amount: amountCents,
      status: paymentIntent.status,
      chargeId: paymentIntent.latest_charge,
    },
    transfer: {
      id: transfer.id,
      destination: affiliate.stripeAccountId,
      amount: commissionCents,
      rate: `${affiliate.commission}%`,
    },
  });
}

/**
 * Simulate a refund with transfer reversal
 * Body: { logId } — uses the _affiliateLogs document ID
 */
async function handleRefund(body: { logId: string }) {
  const { logId } = body;

  if (!logId) {
    return NextResponse.json({ error: 'logId requis' }, { status: 400 });
  }

  const db = getAdminFirestore();

  // Find the log entry
  const logDoc = await db.collection('_affiliateLogs').doc(logId).get();
  if (!logDoc.exists) {
    return NextResponse.json({ error: 'Log de paiement non trouvé' }, { status: 404 });
  }

  const logData = logDoc.data()!;
  if (logData.type !== 'payment') {
    return NextResponse.json({ error: 'Ce log n\'est pas un paiement' }, { status: 400 });
  }
  if (logData.refunded) {
    return NextResponse.json({ error: 'Ce paiement a déjà été remboursé' }, { status: 400 });
  }

  // Step 1: Refund the payment
  const refund = await stripe.refunds.create({
    payment_intent: logData.paymentIntentId,
  });

  // Step 2: Reverse the transfer
  let transferReversal = null;
  if (logData.transferId) {
    transferReversal = await stripe.transfers.createReversal(logData.transferId);
  }

  // Update affiliate stats
  if (logData.affiliateId) {
    await db.collection('affiliates').doc(logData.affiliateId).update({
      'stats.totalRevenue': FieldValue.increment(-logData.amount),
      'stats.totalCommission': FieldValue.increment(-logData.commission),
      updatedAt: new Date(),
    });
  }

  // Mark log as refunded
  await db.collection('_affiliateLogs').doc(logId).update({ refunded: true });

  // Log the refund
  await db.collection('_affiliateLogs').add({
    type: 'refund',
    affiliateId: logData.affiliateId || null,
    affiliateCode: logData.affiliateCode || null,
    paymentIntentId: logData.paymentIntentId,
    transferId: logData.transferId || null,
    refundId: refund.id,
    amount: refund.amount,
    status: refund.status,
    createdAt: new Date(),
  });

  return NextResponse.json({
    success: true,
    refund: {
      id: refund.id,
      amount: refund.amount,
      status: refund.status,
    },
    transferReversal: transferReversal ? {
      id: transferReversal.id,
      amount: transferReversal.amount,
    } : null,
  });
}

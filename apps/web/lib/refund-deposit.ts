/**
 * Deposit refund helper.
 *
 * Encapsulates the Stripe refund + Firestore update for a booking
 * deposit. Used by:
 *   - /api/bookings/cancel  (client/pro cancel)
 *   - /api/pro/bookings/[id]/refund  (pro force-refund past the deadline)
 *   - webhook charge.refunded handler  (sync if the pro refunded via
 *     the Stripe Dashboard directly)
 *
 * Idempotent: if the deposit is already refunded, returns early without
 * calling Stripe again. Safe to call from webhook retries.
 */

import type Stripe from 'stripe';
import { getStripeDev } from './stripe';
import { getAdminFirestore } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface RefundResult {
  refunded: boolean;
  /** When false, indicates we skipped (already refunded, or no deposit). */
  reason?: 'already_refunded' | 'no_deposit' | 'not_paid';
  refundId?: string;
}

interface RefundOptions {
  bookingId: string;
  triggeredBy: 'client' | 'provider' | 'auto';
  reason?: string;
  /** Stripe instance — pass one when the caller already has it (e.g.
   *  webhook handler picking the right env). Defaults to getStripeDev(). */
  stripe?: Stripe;
}

export async function refundBookingDeposit(
  opts: RefundOptions,
): Promise<RefundResult> {
  const db = getAdminFirestore();
  const ref = db.collection('bookings').doc(opts.bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Booking ${opts.bookingId} not found`);

  const booking = snap.data()!;
  const deposit = booking.deposit;

  if (!deposit) return { refunded: false, reason: 'no_deposit' };
  if (deposit.status === 'refunded') {
    return { refunded: false, reason: 'already_refunded' };
  }
  if (deposit.status !== 'paid' || !deposit.paymentIntentId) {
    return { refunded: false, reason: 'not_paid' };
  }

  const stripe = opts.stripe ?? getStripeDev();

  // Two flavours, distinguished by `deposit.connectAccountId`:
  //   - non-null → Direct charge (web Checkout). PaymentIntent lives on
  //     the connected account → refund must use the same Stripe-Account
  //     header.
  //   - null → Destination charge (mobile PaymentSheet). PaymentIntent
  //     lives on the platform → no header needed; the reversed transfer
  //     is automatic.
  // Les frais de service Opatam ne sont JAMAIS remboursés : on ne rembourse
  // que l'acompte. Sur un paiement direct (web), l'application fee reste à
  // la plateforme (refund_application_fee non posé = false) et le compte du
  // pro finance exactement l'acompte. Sur un paiement à destination
  // (mobile), on renverse explicitement TOUT le transfert au pro — un
  // `reverse_transfer` avec montant partiel ne renverserait qu'au prorata et
  // laisserait le pro avec une fraction de l'acompte.
  const serviceFee = Number(deposit.serviceFee) || 0;
  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: deposit.paymentIntentId,
    ...(serviceFee > 0 ? { amount: deposit.amount } : {}),
    metadata: {
      bookingId: opts.bookingId,
      triggeredBy: opts.triggeredBy,
      serviceFeeKept: String(serviceFee),
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
  };
  if (!deposit.connectAccountId && serviceFee === 0) {
    refundParams.reverse_transfer = true;
  }

  const refund = await stripe.refunds.create(
    refundParams,
    deposit.connectAccountId
      ? { stripeAccount: deposit.connectAccountId }
      : undefined,
  );

  if (!deposit.connectAccountId && serviceFee > 0) {
    await reverseDestinationTransfer(stripe, deposit.paymentIntentId, opts.bookingId);
  }

  await ref.update({
    'deposit.status': 'refunded',
    'deposit.refundedAt': new Date(),
    'deposit.refundId': refund.id,
    'deposit.refundedBy': opts.triggeredBy,
    'deposit.refundReason': opts.reason ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { refunded: true, refundId: refund.id };
}

/** Renverse en totalité le transfert d'un paiement à destination (acompte mobile). */
async function reverseDestinationTransfer(stripe: Stripe, paymentIntentId: string, bookingId: string) {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  const charge = intent.latest_charge as Stripe.Charge | null;
  const transferId = typeof charge?.transfer === 'string' ? charge.transfer : charge?.transfer?.id;
  if (!transferId) return;
  const transfer = await stripe.transfers.retrieve(transferId);
  const restant = transfer.amount - transfer.amount_reversed;
  if (restant <= 0) return;
  await stripe.transfers.createReversal(
    transferId,
    { amount: restant, metadata: { bookingId, reason: 'deposit_refund' } },
    { idempotencyKey: `reverse_${bookingId}` },
  );
}

export { isWithinRefundDeadline } from './refund-deadline';

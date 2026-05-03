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
  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: deposit.paymentIntentId,
    metadata: {
      bookingId: opts.bookingId,
      triggeredBy: opts.triggeredBy,
      ...(opts.reason ? { reason: opts.reason } : {}),
    },
  };
  // Destination charges need `reverse_transfer: true` so the funds
  // already routed to the pro come back to the platform.
  if (!deposit.connectAccountId) {
    refundParams.reverse_transfer = true;
  }

  const refund = await stripe.refunds.create(
    refundParams,
    deposit.connectAccountId
      ? { stripeAccount: deposit.connectAccountId }
      : undefined,
  );

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

/**
 * Returns true when `now` is still before the refund deadline computed
 * from the booking's datetime + the deposit's refundDeadlineHours.
 *
 * `refundDeadlineHours: 0` means "no automatic refund window" — return
 * false unconditionally so cancellation never auto-refunds.
 */
export function isWithinRefundDeadline(
  bookingDatetime: Date,
  refundDeadlineHours: number,
  now: Date = new Date(),
): boolean {
  if (refundDeadlineHours <= 0) return false;
  const deadline = new Date(
    bookingDatetime.getTime() - refundDeadlineHours * 60 * 60 * 1000,
  );
  return now < deadline;
}

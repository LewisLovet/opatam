/**
 * La fenêtre de remboursement automatique d'un acompte — module PUR,
 * sans Stripe ni firebase-admin, pour rester importable par les tests.
 * (`refund-deposit.ts` le ré-exporte pour ses appelants historiques.)
 */

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

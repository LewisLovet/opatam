/**
 * Trigger: onBookingCancelledRefund
 *
 * Filet de sécurité SERVEUR pour le remboursement d'acompte à l'annulation.
 *
 * Contexte : le remboursement est normalement déclenché par
 * `/api/bookings/cancel` (web + apps à jour). Mais une annulation faite en
 * direct via le SDK Firestore — anciennes versions de l'app mobile, CLIENT
 * comme PRO — court-circuitait ce chemin, laissant des acomptes non remboursés
 * alors qu'ils étaient dus. Ce trigger rattrape TOUTES les annulations, quel
 * que soit le chemin, sans nécessiter de mise à jour de l'app (déploiement
 * Firebase uniquement).
 *
 * Idempotent :
 *  - ne s'exécute qu'à la TRANSITION vers 'cancelled' (before != 'cancelled') ;
 *  - ignore si l'acompte n'est pas 'paid' (déjà remboursé → 'refunded' → skip) ;
 *  - clé d'idempotence Stripe `refund_<bookingId>` en dernier rempart ;
 *  - sa propre écriture (deposit → 'refunded') re-déclenche le trigger, mais
 *    la garde de transition le fait sortir immédiatement.
 *
 * Politique alignée sur l'API : remboursement automatique UNIQUEMENT si
 * l'annulation est intervenue dans le délai (`refundDeadlineHours`). Hors
 * délai, le pro peut toujours forcer le remboursement depuis son espace.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';

// Clé Stripe plateforme (fournie via functions/.env, comme le cron de purge).
// L'acompte mobile est une Destination charge sur la plateforme (pas d'en-tête
// Stripe-Account) ; l'acompte web Checkout est une Direct charge sur le compte
// connecté → refund avec `stripeAccount`.
const stripeSecretKey = defineString('STRIPE_SECRET_KEY');
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey.value());
  }
  return stripeClient;
}

/** true si `now` est encore avant la deadline (datetime - refundDeadlineHours). */
function isWithinRefundDeadline(
  datetime: Date,
  refundDeadlineHours: number,
  now: Date,
): boolean {
  if (!refundDeadlineHours || refundDeadlineHours <= 0) return false;
  const deadline = new Date(
    datetime.getTime() - refundDeadlineHours * 60 * 60 * 1000,
  );
  return now < deadline;
}

export const onBookingCancelledRefund = onDocumentWritten(
  {
    document: 'bookings/{bookingId}',
    region: 'europe-west1',
  },
  async (event) => {
    const bookingId = event.params.bookingId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after) return; // suppression

    // Uniquement à la transition vers 'cancelled'.
    if (before?.status === 'cancelled' || after.status !== 'cancelled') return;

    const deposit = after.deposit;
    // Rien à faire : pas d'acompte, non payé, ou déjà remboursé.
    if (!deposit || deposit.status !== 'paid' || !deposit.paymentIntentId) return;
    if (deposit.refundedAt || deposit.refundId) return;

    // Refund dû uniquement si l'annulation est dans le délai (aligné sur l'API).
    const datetime: Date =
      typeof after.datetime?.toDate === 'function'
        ? after.datetime.toDate()
        : new Date(after.datetime);
    const cancelledAt: Date =
      typeof after.cancelledAt?.toDate === 'function'
        ? after.cancelledAt.toDate()
        : new Date();

    if (!isWithinRefundDeadline(datetime, deposit.refundDeadlineHours, cancelledAt)) {
      console.log(
        `[cancel-refund] ${bookingId}: hors délai → pas de remboursement auto`,
      );
      return;
    }

    try {
      const stripe = getStripe();
      const params: Stripe.RefundCreateParams = {
        payment_intent: deposit.paymentIntentId,
        metadata: {
          bookingId,
          triggeredBy: 'auto-cf',
          cancelledBy: after.cancelledBy ?? 'unknown',
        },
      };
      // Destination charge (acompte mobile, connectAccountId null) : renvoyer
      // aussi vers la plateforme les fonds déjà transférés au pro.
      if (!deposit.connectAccountId) {
        params.reverse_transfer = true;
      }

      const requestOptions: Stripe.RequestOptions = {
        idempotencyKey: `refund_${bookingId}`,
      };
      if (deposit.connectAccountId) {
        requestOptions.stripeAccount = deposit.connectAccountId;
      }

      const refund = await stripe.refunds.create(params, requestOptions);

      await event.data!.after!.ref.update({
        'deposit.status': 'refunded',
        'deposit.refundedAt': new Date(),
        'deposit.refundId': refund.id,
        'deposit.refundedBy': after.cancelledBy ?? 'auto',
        'deposit.refundReason': after.cancelReason ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`[cancel-refund] ${bookingId}: acompte remboursé (${refund.id})`);
    } catch (err) {
      // Ne PAS relancer : un échec isolé (ex. booking de test sur clé live)
      // ne doit pas bloquer le trigger ni provoquer des retries infinis.
      // On loggue pour investigation manuelle.
      console.error(`[cancel-refund] ${bookingId}: échec du remboursement:`, err);
    }
  },
);

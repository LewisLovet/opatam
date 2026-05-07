// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripeDev } from '@/lib/stripe';

/**
 * POST /api/bookings/abandon
 *
 * Releases a `pending_payment` booking that the client never paid for —
 * typically when they close the native PaymentSheet on mobile or close
 * the Stripe Checkout tab on web. Frees the slot immediately so the
 * same client (or someone else) can rebook without waiting 30 min for
 * the cron purge.
 *
 * Strict guards:
 *   - booking must exist and be in `pending_payment` status
 *   - clientId in the body must match booking.clientId (soft auth, same
 *     pattern as POST /api/bookings)
 *   - if a Stripe PaymentIntent was created, we cancel it so it doesn't
 *     stay in `requires_payment_method` forever (no charge had been made)
 *
 * Idempotent: if the booking is already gone, we still 200 — the slot
 * is free either way.
 */

const bodySchema = z.object({
  bookingId: z.string().min(1, 'bookingId requis'),
  clientId: z.string().min(1, 'clientId requis'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, clientId } = bodySchema.parse(body);

    const db = getAdminFirestore();
    const ref = db.collection('bookings').doc(bookingId);
    const snap = await ref.get();

    // Already deleted → idempotent success
    if (!snap.exists) {
      return NextResponse.json({ abandoned: true, alreadyGone: true });
    }

    const booking = snap.data()!;

    // Only pending_payment bookings can be abandoned this way. A confirmed
    // booking must go through the proper /cancel flow (refund logic etc.).
    if (booking.status !== 'pending_payment') {
      return NextResponse.json(
        { error: 'Cette réservation n\'est pas en attente de paiement' },
        { status: 409 },
      );
    }

    // Soft auth: clientId must match. The POST /api/bookings creator uses
    // the same trust model, so we mirror it here.
    if (booking.clientId !== clientId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Best-effort: cancel the PaymentIntent so it doesn't sit forever in
    // requires_payment_method. No charge was ever captured, so there's
    // nothing to refund. Failures here are non-blocking — we still
    // delete the booking and free the slot.
    const paymentIntentId = booking.deposit?.paymentIntentId as
      | string
      | undefined;
    if (paymentIntentId) {
      try {
        const stripe = getStripeDev();
        await stripe.paymentIntents.cancel(paymentIntentId);
      } catch (err) {
        // Ignore — the intent may already be canceled, succeeded, or
        // gone. The slot release is what matters.
        console.warn(
          '[BOOKINGS/ABANDON] PI cancel failed (non-blocking):',
          err instanceof Error ? err.message : err,
        );
      }
    }

    await ref.delete();
    return NextResponse.json({ abandoned: true });
  } catch (error) {
    console.error('[BOOKINGS/ABANDON] error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Données invalides' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 },
    );
  }
}

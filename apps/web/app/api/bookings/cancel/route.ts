// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bookingService, providerService } from '@booking-app/firebase';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import {
  refundBookingDeposit,
  isWithinRefundDeadline,
} from '@/lib/refund-deposit';

/**
 * POST /api/bookings/cancel
 *
 * Unified cancel endpoint for both:
 *   - Clients   → identified by `cancelToken` (from the email link)
 *   - Providers → identified by Firebase ID token + `bookingId`
 *
 * For deposit bookings, also handles the refund:
 *   - Within the configured deadline → automatic refund
 *   - Past the deadline              → no refund unless `forceRefund:true`
 *                                      (pro-only flag, ignored for clients)
 *
 * Returns `{ cancelled: true, refunded: boolean, refundReason?: string }`
 * so the UI can adjust messaging.
 */

const bodySchema = z
  .object({
    cancelToken: z.string().optional(),
    bookingId: z.string().optional(),
    reason: z.string().max(200).optional(),
    forceRefund: z.boolean().optional(),
  })
  .refine((d) => !!d.cancelToken || !!d.bookingId, {
    message: 'cancelToken ou bookingId requis',
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.parse(body);

    // ─── Resolve the booking + identify the actor ─────────────────────
    let bookingId: string;
    let actor: 'client' | 'provider';
    let actorUserId: string | null = null;

    if (parsed.cancelToken) {
      // Client flow — token-based, no auth header needed.
      const db = getAdminFirestore();
      const snap = await db
        .collection('bookings')
        .where('cancelToken', '==', parsed.cancelToken)
        .limit(1)
        .get();

      if (snap.empty) {
        return NextResponse.json(
          { error: 'Lien d\'annulation invalide' },
          { status: 404 },
        );
      }
      bookingId = snap.docs[0].id;
      actor = 'client';
    } else {
      // Pro flow — must be authenticated and must own the booking.
      const authHeader = request.headers.get('authorization') ?? '';
      if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
      }
      const idToken = authHeader.slice('Bearer '.length);
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      actorUserId = decoded.uid;

      bookingId = parsed.bookingId!;
      const booking = await bookingService.getById(bookingId);
      if (!booking) {
        return NextResponse.json(
          { error: 'Réservation introuvable' },
          { status: 404 },
        );
      }
      const provider = await providerService.getById(booking.providerId);
      if (!provider || provider.userId !== actorUserId) {
        return NextResponse.json(
          { error: 'Accès refusé' },
          { status: 403 },
        );
      }
      actor = 'provider';
    }

    // ─── Read the booking once for refund decisioning ─────────────────
    const booking = await bookingService.getById(bookingId);
    if (!booking) {
      return NextResponse.json(
        { error: 'Réservation introuvable' },
        { status: 404 },
      );
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cette réservation est déjà annulée' },
        { status: 409 },
      );
    }

    // ─── Refund decision (made BEFORE cancelling so we don't end up
    //     with a cancelled booking + failed refund + no recovery path).
    let refundDecision:
      | { mode: 'auto' }
      | { mode: 'force' }
      | { mode: 'skip'; why: 'no_deposit' | 'past_deadline' | 'not_paid' } =
      { mode: 'skip', why: 'no_deposit' };

    if (booking.deposit && booking.deposit.status === 'paid') {
      const within = isWithinRefundDeadline(
        booking.datetime,
        booking.deposit.refundDeadlineHours,
      );
      if (within) {
        refundDecision = { mode: 'auto' };
      } else if (actor === 'provider' && parsed.forceRefund) {
        refundDecision = { mode: 'force' };
      } else {
        refundDecision = { mode: 'skip', why: 'past_deadline' };
      }
    } else if (booking.deposit) {
      refundDecision = { mode: 'skip', why: 'not_paid' };
    }

    // ─── Run the refund (if any), then cancel ─────────────────────────
    let refundedThisCall = false;
    let refundError: string | null = null;
    if (refundDecision.mode === 'auto' || refundDecision.mode === 'force') {
      try {
        const result = await refundBookingDeposit({
          bookingId,
          triggeredBy: actor,
          reason:
            refundDecision.mode === 'force'
              ? parsed.reason || 'Remboursement accordé par le pro'
              : parsed.reason,
        });
        refundedThisCall = result.refunded;
      } catch (err) {
        // Refund failed — bail out before cancelling so the user can retry.
        refundError = err instanceof Error ? err.message : String(err);
        console.error('[BOOKINGS/CANCEL] refund failed:', refundError);
        return NextResponse.json(
          {
            error:
              "Le remboursement n'a pas pu être effectué. Réessayez ou contactez le support.",
          },
          { status: 502 },
        );
      }
    }

    // ─── Cancel the booking ───────────────────────────────────────────
    if (actor === 'client') {
      await bookingService.cancelBookingByToken(
        parsed.cancelToken!,
        parsed.reason,
      );
    } else {
      await bookingService.cancelBooking(
        bookingId,
        'provider',
        actorUserId!,
        parsed.reason,
      );
    }

    return NextResponse.json({
      cancelled: true,
      refunded: refundedThisCall,
      ...(refundDecision.mode === 'skip'
        ? { refundSkipReason: refundDecision.why }
        : {}),
    });
  } catch (error) {
    console.error('[BOOKINGS/CANCEL] error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Données invalides' },
        { status: 400 },
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 },
    );
  }
}

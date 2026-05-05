/**
 * Deposits playground — local-friendly E2E without Stripe.
 *
 * Lets the dev tool create a fake booking with a deposit pending,
 * then simulate each lifecycle event the webhook would normally
 * receive. The state mutations here mirror exactly what the webhook
 * handlers in /api/stripe/webhook do (see handleDepositCheckout-
 * Completed, handleChargeRefunded, etc.) — kept in sync manually.
 *
 * Why not call the real handlers? They pull a Stripe object from a
 * webhook event we'd have to fabricate, including signature.
 * Replicating the Firestore mutation directly is simpler and tests
 * the same observable outcomes.
 *
 * Ops:
 *   GET                     → list playground bookings (last 20)
 *   POST { action: 'create' }
 *                           → create a fake pending_payment booking
 *   POST { action: 'simulate', bookingId, event }
 *                           → mutate the booking as the webhook would
 *   POST { action: 'cleanup' }
 *                           → delete all playground bookings
 *
 * Bookings are tagged with `_playground: true` so they're easy to
 * filter out of real queries (and the cleanup is safe).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

interface LogLine {
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

const log = (level: LogLine['level'], message: string): LogLine => ({
  ts: new Date().toISOString(),
  level,
  message,
});

// ─── GET — list ──────────────────────────────────────────────────────

export async function GET() {
  const db = getAdminFirestore();
  const snap = await db
    .collection('bookings')
    .where('_playground', '==', true)
    .limit(20)
    .get();

  const bookings = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      status: d.status,
      providerName: d.providerName,
      clientName: d.clientInfo?.name,
      serviceName: d.serviceName,
      datetime: d.datetime?.toDate?.()?.toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      deposit: d.deposit
        ? {
            amount: d.deposit.amount,
            status: d.deposit.status,
            refundDeadlineHours: d.deposit.refundDeadlineHours,
            paidAt: d.deposit.paidAt?.toDate?.()?.toISOString() ?? null,
            refundedAt: d.deposit.refundedAt?.toDate?.()?.toISOString() ?? null,
            disputeId: d.deposit.disputeId ?? null,
            disputeStatus: d.deposit.disputeStatus ?? null,
          }
        : null,
    };
  });

  // Sort newest first (we don't orderBy in the query because that
  // would require a composite index for `_playground == true`).
  bookings.sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );

  return NextResponse.json({ bookings });
}

// ─── POST — actions ──────────────────────────────────────────────────

interface CreateBody {
  action: 'create';
  refundDeadlineHours?: number;
  bookingDatetimeOffsetHours?: number;
}
interface SimulateBody {
  action: 'simulate';
  bookingId: string;
  event:
    | 'payment_success'
    | 'payment_expired'
    | 'payment_failed'
    | 'refund'
    | 'dispute_created';
}
interface CleanupBody {
  action: 'cleanup';
}
type ActionBody = CreateBody | SimulateBody | CleanupBody;

export async function POST(request: NextRequest) {
  const db = getAdminFirestore();
  const body = (await request.json()) as ActionBody;
  const logs: LogLine[] = [];

  // ─── create ───────────────────────────────────────────────────────
  if (body.action === 'create') {
    const refundDeadlineHours = body.refundDeadlineHours ?? 24;
    const offsetHours = body.bookingDatetimeOffsetHours ?? 48;
    const datetime = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const endDatetime = new Date(datetime.getTime() + 30 * 60 * 1000);
    const cancelToken = Math.random().toString(36).slice(2, 18);

    const ref = db.collection('bookings').doc();
    await ref.set({
      _playground: true, // ← tag for filtering / cleanup
      providerId: 'playground-provider',
      providerName: 'Pro de test (playground)',
      clientId: null,
      clientInfo: {
        name: 'Client test',
        email: 'client.test@example.com',
        phone: '+33600000000',
      },
      serviceId: 'playground-service',
      serviceName: 'Prestation test (avec acompte)',
      duration: 30,
      price: 5000,
      memberId: null,
      memberName: null,
      memberPhoto: null,
      memberColor: '#3b82f6',
      providerPhoto: null,
      locationId: 'playground-location',
      locationName: 'Salon de test',
      locationAddress: '1 rue de la République, 75001 Paris',
      datetime: Timestamp.fromDate(datetime),
      endDatetime: Timestamp.fromDate(endDatetime),
      status: 'pending_payment',
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      cancelToken,
      remindersSent: [],
      reviewRequestSentAt: null,
      deposit: {
        amount: 1500, // 15 €
        refundDeadlineHours,
        paymentIntentId: null,
        connectAccountId: null,
        checkoutSessionId: 'cs_playground_' + Math.random().toString(36).slice(2, 10),
        checkoutUrl: null,
        status: 'pending',
        paidAt: null,
        refundedAt: null,
        refundId: null,
        refundedBy: null,
        refundReason: null,
        reminderSentAt: null,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logs.push(
      log('success', `Booking créé : ${ref.id} (status pending_payment, acompte 15 €, délai ${refundDeadlineHours}h)`),
    );
    logs.push(
      log('info', `RDV simulé dans ${offsetHours}h, durée 30min`),
    );

    return NextResponse.json({ bookingId: ref.id, logs });
  }

  // ─── simulate event ───────────────────────────────────────────────
  if (body.action === 'simulate') {
    const ref = db.collection('bookings').doc(body.bookingId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: 'Booking introuvable', logs: [log('error', `Booking ${body.bookingId} introuvable`)] },
        { status: 404 },
      );
    }
    const before = snap.data()!;

    switch (body.event) {
      case 'payment_success': {
        // Mirrors handleDepositCheckoutCompleted
        if (before.status === 'confirmed' && before.deposit?.status === 'paid') {
          logs.push(log('warn', 'Booking déjà confirmed/paid — handler skipperait (idempotence)'));
        } else {
          await ref.update({
            status: 'confirmed',
            'deposit.status': 'paid',
            'deposit.paidAt': new Date(),
            'deposit.paymentIntentId': 'pi_playground_' + Math.random().toString(36).slice(2, 10),
            updatedAt: FieldValue.serverTimestamp(),
          });
          logs.push(log('success', `webhook checkout.session.completed → booking flippé en confirmed, deposit.status=paid`));
          logs.push(log('info', 'En prod : email confirmation envoyé au client + notification au pro (Cloud Function)'));
        }
        break;
      }

      case 'payment_expired': {
        // Mirrors handleDepositCheckoutExpired
        if (before.status !== 'pending_payment') {
          logs.push(log('warn', `status=${before.status} — handler skipperait (sécurité)`));
        } else {
          await ref.delete();
          logs.push(log('success', 'webhook checkout.session.expired → booking supprimé, créneau libéré'));
        }
        return NextResponse.json({ deleted: true, logs });
      }

      case 'payment_failed': {
        // Mirrors handlePaymentIntentFailed (Connect)
        await ref.update({
          'deposit.lastFailureCode': 'card_declined',
          'deposit.lastFailureAt': new Date(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        logs.push(log('info', 'webhook payment_intent.payment_failed → deposit.lastFailureCode=card_declined'));
        logs.push(log('info', 'Booking reste en pending_payment — le client peut retenter, ou le cron purge à 30min'));
        break;
      }

      case 'refund': {
        // Mirrors handleChargeRefunded
        if (before.deposit?.status !== 'paid') {
          logs.push(log('warn', `deposit.status=${before.deposit?.status} — refund skip (handler vérifie 'paid')`));
        } else {
          await ref.update({
            'deposit.status': 'refunded',
            'deposit.refundedAt': new Date(),
            'deposit.refundId': 're_playground_' + Math.random().toString(36).slice(2, 10),
            'deposit.refundedBy': 'provider',
            updatedAt: FieldValue.serverTimestamp(),
          });
          logs.push(log('success', 'webhook charge.refunded → deposit.status=refunded (refund externe via Stripe Dashboard)'));
        }
        break;
      }

      case 'dispute_created': {
        // Mirrors handleChargeDisputeCreated
        await ref.update({
          'deposit.disputeId': 'dp_playground_' + Math.random().toString(36).slice(2, 10),
          'deposit.disputeStatus': 'needs_response',
          'deposit.disputeReason': 'fraudulent',
          'deposit.disputedAt': new Date(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        logs.push(log('warn', 'webhook charge.dispute.created → deposit.disputeId set, motif "fraudulent"'));
        logs.push(log('info', 'En prod : email d\'alerte envoyé au pro avec contexte RDV + lien Stripe Dashboard'));
        break;
      }
    }

    const after = (await ref.get()).data();
    return NextResponse.json({ booking: serialize(body.bookingId, after), logs });
  }

  // ─── cleanup ──────────────────────────────────────────────────────
  if (body.action === 'cleanup') {
    const snap = await db
      .collection('bookings')
      .where('_playground', '==', true)
      .get();
    const deleted = snap.size;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    logs.push(log('success', `${deleted} booking(s) playground supprimé(s)`));
    return NextResponse.json({ deleted, logs });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

function serialize(id: string, d: FirebaseFirestore.DocumentData | undefined) {
  if (!d) return null;
  return {
    id,
    status: d.status,
    deposit: d.deposit
      ? {
          amount: d.deposit.amount,
          status: d.deposit.status,
          paidAt: d.deposit.paidAt?.toDate?.()?.toISOString() ?? null,
          refundedAt: d.deposit.refundedAt?.toDate?.()?.toISOString() ?? null,
          disputeId: d.deposit.disputeId ?? null,
          disputeStatus: d.deposit.disputeStatus ?? null,
          lastFailureCode: d.deposit.lastFailureCode ?? null,
        }
      : null,
  };
}

/**
 * Scheduled: purgePendingPaymentBookings
 *
 * Runs every 5 minutes. Two responsibilities for bookings stuck in
 * `pending_payment`:
 *
 *  1. **Reminder** — at ~15 min of age (halfway through the Checkout
 *     window), email the client a "finish your payment" nudge with the
 *     same Stripe Checkout URL. Sent at most once per booking, tracked
 *     via `deposit.reminderSentAt`.
 *
 *  2. **Purge** — at >30 min of age, delete the booking. The Stripe
 *     session is already expired by then, and we want the slot free.
 *
 * Confirmation emails were never sent (handleBookingEmails defers them
 * until the deposit is paid), so deletion is silent.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendDepositReminderEmail } from '../utils/resendService';

const REMIND_AFTER_MINUTES = 15;
const STALE_AFTER_MINUTES = 30;

export const purgePendingPaymentBookings = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 60,
  },
  async () => {
    const startedAt = Date.now();
    console.log('=== purgePendingPaymentBookings started ===');

    const db = admin.firestore();
    const now = Date.now();
    const remindCutoff = new Date(now - REMIND_AFTER_MINUTES * 60 * 1000);
    const purgeCutoff = new Date(now - STALE_AFTER_MINUTES * 60 * 1000);

    // Single query: every pending_payment booking older than the reminder
    // threshold. We split purge vs. remind in JS — a single read is
    // cheaper than two queries with overlapping ranges.
    const snap = await db
      .collection('bookings')
      .where('status', '==', 'pending_payment')
      .where('createdAt', '<', Timestamp.fromDate(remindCutoff))
      .get();

    if (snap.empty) {
      console.log('No pending_payment bookings to handle');
      console.log(`=== completed in ${Date.now() - startedAt}ms ===`);
      return;
    }

    const toPurge: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const toRemind: FirebaseFirestore.QueryDocumentSnapshot[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const createdAt: Date | undefined = data.createdAt?.toDate?.();
      if (!createdAt) continue;

      if (createdAt < purgeCutoff) {
        toPurge.push(doc);
      } else if (!data.deposit?.reminderSentAt) {
        toRemind.push(doc);
      }
    }

    console.log(
      `Found ${toRemind.length} to remind, ${toPurge.length} to purge`,
    );

    // 1. Reminders. Fire-and-forget per booking — one failure shouldn't
    //    block the others.
    await Promise.all(
      toRemind.map(async (doc) => {
        const data = doc.data();
        const checkoutUrl: string | undefined = data.deposit?.checkoutUrl;
        const clientEmail: string | undefined = data.clientInfo?.email;
        const depositAmount: number | undefined = data.deposit?.amount;
        const datetime: Date | undefined = data.datetime?.toDate?.();
        const createdAt: Date | undefined = data.createdAt?.toDate?.();

        if (!checkoutUrl || !clientEmail || !depositAmount || !datetime || !createdAt) {
          console.warn(
            `[reminder] booking ${doc.id} missing fields — skipping`,
          );
          return;
        }

        const minutesLeft = Math.max(
          1,
          Math.round(
            (createdAt.getTime() + STALE_AFTER_MINUTES * 60 * 1000 - now) /
              60000,
          ),
        );

        try {
          const result = await sendDepositReminderEmail({
            clientEmail,
            clientName: data.clientInfo?.name || 'cher client',
            serviceName: data.serviceName,
            datetime,
            duration: data.duration || 60,
            depositAmount,
            providerName: data.providerName,
            checkoutUrl,
            minutesLeft,
            cancelToken: data.cancelToken ?? null,
          });

          if (result.success) {
            await doc.ref.update({
              'deposit.reminderSentAt': FieldValue.serverTimestamp(),
            });
            console.log(`[reminder] sent for booking ${doc.id}`);
          } else {
            console.warn(
              `[reminder] failed for ${doc.id}: ${result.error ?? 'unknown'}`,
            );
          }
        } catch (err) {
          console.error(`[reminder] exception for ${doc.id}:`, err);
        }
      }),
    );

    // 2. Purges. Batch deletes for efficiency.
    if (toPurge.length > 0) {
      const CHUNK = 400;
      for (let i = 0; i < toPurge.length; i += CHUNK) {
        const batch = db.batch();
        for (const doc of toPurge.slice(i, i + CHUNK)) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }

    console.log(
      `Done in ${Date.now() - startedAt}ms — reminders: ${toRemind.length}, purged: ${toPurge.length}`,
    );
  },
);

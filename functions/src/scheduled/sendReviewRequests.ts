/**
 * Scheduled: sendReviewRequests
 *
 * Runs every 6 hours and emails clients an "How was it?" review
 * request for each confirmed booking that:
 *   - has finished within the last 7 days (we send between 1h
 *     and 7d after the appointment end-time, the wide window
 *     gives the cron a comfortable retry margin)
 *   - hasn't already received the request (reviewRequestSentAt
 *     is null)
 *   - belongs to a provider whose `settings.autoReviewReminder`
 *     is unset (default behaviour) or `true` — explicit `false`
 *     opts the salon out
 *
 * Idempotent: stamping `reviewRequestSentAt` after a successful
 * Resend call is the dedup mechanism — re-running the cron in
 * the same window won't double-send.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendReviewRequestEmail } from '../utils/resendService';
import { serverTracker } from '../utils/serverTracker';

interface SendResult {
  bookingId: string;
  success: boolean;
  reason: string;
}

const LOOKBACK_DAYS = 7;
/** Skip bookings ending within the last hour — gives the pro a
 *  buffer to mark a no-show before the email goes out. */
const MIN_DELAY_MINUTES = 60;
/** Defensive cap so a backlog can't hammer Resend in one tick.
 *  At 6h cadence with a salon doing 30 RDV/day, the natural
 *  daily volume is ~30 emails — easily under this. */
const MAX_PER_RUN = 200;

// Cache provider settings across the run — multiple bookings
// often share the same provider, no need to re-read each time.
type ProviderSettings = { autoReviewReminder: boolean };
const providerCache = new Map<string, ProviderSettings>();

async function getProviderSettings(
  db: FirebaseFirestore.Firestore,
  providerId: string,
): Promise<ProviderSettings> {
  const cached = providerCache.get(providerId);
  if (cached) return cached;

  try {
    const doc = await db.collection('providers').doc(providerId).get();
    serverTracker.trackRead('providers', 1);
    const data = doc.data();
    // Default `true` when unset — pros opt out explicitly.
    const autoReviewReminder = data?.settings?.autoReviewReminder !== false;
    const settings: ProviderSettings = { autoReviewReminder };
    providerCache.set(providerId, settings);
    return settings;
  } catch (err) {
    console.error(`[review-requests] failed to load provider ${providerId}:`, err);
    // Fail closed — don't spam if we couldn't verify the toggle.
    const settings: ProviderSettings = { autoReviewReminder: false };
    providerCache.set(providerId, settings);
    return settings;
  }
}

export const sendReviewRequests = onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('sendReviewRequests');
    console.log('=== sendReviewRequests started ===');

    // Skip during night hours so the email lands at a reasonable
    // time. The cron may queue up to 4 runs/day; running between
    // 8h and 22h Paris is enough to catch every RDV ≤ 24h late.
    const parisHour = new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(parisHour, 10);
    if (hour < 8 || hour >= 22) {
      console.log(`Quiet hours (${hour}h Paris) — skipping review requests`);
      serverTracker.endContext();
      return;
    }

    const db = admin.firestore();
    const now = new Date();
    const windowStart = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() - MIN_DELAY_MINUTES * 60 * 1000);

    try {
      // Confirmed bookings whose start time is in the window. We
      // filter on datetime even though "ended" is more accurate —
      // duration is stored on the doc and Firestore can't index a
      // computed end-time, so we accept a tiny sliver of overlap
      // (a 4h-long booking starting at -4h05min is still in the
      // window) and let the MIN_DELAY_MINUTES on START provide the
      // no-show buffer.
      const snapshot = await db
        .collection('bookings')
        .where('status', '==', 'confirmed')
        .where('datetime', '>=', Timestamp.fromDate(windowStart))
        .where('datetime', '<=', Timestamp.fromDate(windowEnd))
        .orderBy('datetime', 'asc')
        .limit(MAX_PER_RUN)
        .get();
      serverTracker.trackRead('bookings', snapshot.size);

      console.log(`Found ${snapshot.size} confirmed bookings in window`);

      const results: SendResult[] = [];
      providerCache.clear();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const bookingId = doc.id;

        // Skip if already sent — the dedup check.
        if (data.reviewRequestSentAt) {
          continue;
        }

        // Skip anonymous bookings without an email.
        const clientEmail = data.clientInfo?.email;
        if (!clientEmail || typeof clientEmail !== 'string') {
          results.push({
            bookingId,
            success: false,
            reason: 'no client email',
          });
          continue;
        }

        // Provider-level opt-out.
        const providerId = data.providerId;
        if (!providerId) continue;
        const { autoReviewReminder } = await getProviderSettings(db, providerId);
        if (!autoReviewReminder) {
          results.push({
            bookingId,
            success: false,
            reason: 'provider opted out',
          });
          continue;
        }

        // Send + stamp.
        const datetime = data.datetime?.toDate?.() ?? new Date(data.datetime);
        const result = await sendReviewRequestEmail({
          bookingId,
          clientEmail,
          clientName: data.clientInfo?.name ?? 'Client',
          serviceName: data.serviceName ?? 'Prestation',
          datetime,
          providerName: data.providerName ?? 'votre prestataire',
        });

        if (result.success) {
          try {
            await db.collection('bookings').doc(bookingId).update({
              reviewRequestSentAt: FieldValue.serverTimestamp(),
            });
            serverTracker.trackWrite('bookings', 1);
            results.push({ bookingId, success: true, reason: 'sent' });
          } catch (err) {
            console.error(
              `[review-requests] stamp failed for ${bookingId}:`,
              err,
            );
            // Critical: the email went out but we couldn't stamp.
            // The next run might re-send. Log loudly so we can
            // hand-fix if it ever happens.
            results.push({
              bookingId,
              success: false,
              reason: 'sent but stamp failed',
            });
          }
        } else {
          results.push({
            bookingId,
            success: false,
            reason: result.error || 'email failed',
          });
        }
      }

      const sent = results.filter((r) => r.success).length;
      const skipped = results.filter((r) => !r.success).length;
      console.log(
        `=== sendReviewRequests done in ${Date.now() - startTime}ms — sent: ${sent}, skipped: ${skipped} ===`,
      );
      if (skipped > 0) {
        const reasons = results
          .filter((r) => !r.success)
          .reduce<Record<string, number>>((acc, r) => {
            acc[r.reason] = (acc[r.reason] ?? 0) + 1;
            return acc;
          }, {});
        console.log('[review-requests] skip reasons:', reasons);
      }
    } catch (err) {
      console.error('[review-requests] fatal error:', err);
    } finally {
      serverTracker.endContext();
    }
  },
);

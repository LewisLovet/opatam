/**
 * Scheduled: recomputeProviderStats
 *
 * Runs daily at 03:00 Europe/Paris. Two responsibilities:
 *
 *   1. Safety net — recompute providerStatsRolling for every active
 *      provider. The rolling snapshot is not maintained by the
 *      booking trigger (would be too expensive on every write), so
 *      the cron is the canonical refresh path for top services /
 *      top clients / heatmap.
 *
 *   2. Tag refresh — providerClients.tags depends on relative
 *      time-since-last-booking thresholds. Without a daily refresh
 *      a `regular` client who hasn't booked in 4 months would
 *      stay tagged `regular` forever. The cron walks all client
 *      docs, recomputes tags, writes back if changed.
 *
 * The trigger keeps daily, monthly and per-client *counters* fresh
 * in real time; this cron handles the time-relative derivations.
 *
 * Scope: iterates all providers. Capped at MAX_PROVIDERS per run
 * to stay within the function's budget; for ≥1000 active providers
 * we'll need to shard across multiple slots.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  aggregateRolling,
  bookingFromFirestore,
  clientDocId,
  computeClientTags,
  type BookingLike,
  type ProviderClient,
  type ProviderStatsDaily,
  type ProviderStatsRolling,
} from '../lib/providerStatsAgg';

const DEFAULT_TIMEZONE = 'Europe/Paris';
const MAX_PROVIDERS = 1000;

export const recomputeProviderStats = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    // Pull all providers — could be filtered to "active in last
    // 90d" once we have that signal denormalised on the doc.
    const providersSnap = await db
      .collection('providers')
      .limit(MAX_PROVIDERS)
      .get();

    let processed = 0;
    let failures = 0;

    for (const providerDoc of providersSnap.docs) {
      const providerId = providerDoc.id;
      try {
        await Promise.all([
          refreshRollingFor(db, providerId, now),
          refreshClientTagsFor(db, providerId, now),
        ]);
        processed += 1;
      } catch (err) {
        failures += 1;
        console.error(`[recomputeProviderStats] failed for ${providerId}`, err);
      }
    }

    console.log(
      `[recomputeProviderStats] done — processed=${processed} failures=${failures}`,
    );
  },
);

/**
 * Recompute the rolling snapshot for one provider. Pulls last-90-day
 * bookings + the existing daily docs (cheaper than re-aggregating
 * raw bookings of the whole window) and computes top-K + heatmap.
 */
async function refreshRollingFor(
  db: admin.firestore.Firestore,
  providerId: string,
  now: Date,
): Promise<void> {
  const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [dailiesSnap, bookingsSnap] = await Promise.all([
    db.collection('providerStatsDaily').where('providerId', '==', providerId).get(),
    // For top-clients revenue we need actual bookings — top-services
    // can be derived from dailies but topClients per-client revenue
    // requires per-booking access. Limit to 90d window to stay cheap.
    db
      .collection('bookings')
      .where('providerId', '==', providerId)
      .where('datetime', '>=', Timestamp.fromDate(cutoff90))
      .get(),
  ]);

  const dailies: ProviderStatsDaily[] = dailiesSnap.docs.map(
    (d) => d.data() as ProviderStatsDaily,
  );
  const bookings: BookingLike[] = bookingsSnap.docs.map((d) =>
    bookingFromFirestore(d.data()),
  );

  // For all-time top services we use ALL dailies; for all-time top
  // clients we ideally want all bookings but that defeats the point
  // — instead we keep "all-time" topClients limited to last 90d as
  // well, since the value of the panel is "who's spending recently".
  // Document this intentional trade-off in the rolling type comments
  // when we revisit.

  const rolling: ProviderStatsRolling = aggregateRolling(
    dailies,
    bookings,
    providerId,
    now,
    DEFAULT_TIMEZONE,
  );

  await db
    .collection('providerStatsRolling')
    .doc(providerId)
    .set(rolling, { merge: false });
}

/**
 * Walk all client docs of a provider, recompute tags, write back
 * only if the array changed (saves writes when nothing transitioned).
 */
async function refreshClientTagsFor(
  db: admin.firestore.Firestore,
  providerId: string,
  now: Date,
): Promise<void> {
  const snap = await db
    .collection('providerClients')
    .where('providerId', '==', providerId)
    .get();

  const writes: Promise<unknown>[] = [];
  for (const doc of snap.docs) {
    const c = doc.data() as ProviderClient;
    // Hydrate Timestamps → Dates for the tag computation.
    const firstAt = c.firstBookingAt instanceof Date
      ? c.firstBookingAt
      : (c.firstBookingAt as unknown as Timestamp)?.toDate?.() ?? new Date();
    const lastAt = c.lastBookingAt instanceof Date
      ? c.lastBookingAt
      : (c.lastBookingAt as unknown as Timestamp)?.toDate?.() ?? new Date();

    const newTags = computeClientTags(
      {
        firstBookingAt: firstAt,
        lastBookingAt: lastAt,
        bookingsCount: c.bookingsCount,
        confirmedCount: c.confirmedCount,
        noshowCount: c.noshowCount,
        totalRevenue: c.totalRevenue,
      },
      now,
    );

    const changed =
      newTags.length !== (c.tags?.length ?? 0) ||
      newTags.some((t, i) => t !== c.tags?.[i]);

    if (changed) {
      writes.push(
        doc.ref.update({
          tags: newTags,
          updatedAt: now,
        }),
      );
    }
  }

  await Promise.all(writes);

  // Helper: silence linter for unused param when no docs.
  void clientDocId;
}

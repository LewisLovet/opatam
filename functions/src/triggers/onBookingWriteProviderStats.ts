/**
 * Trigger: onBookingWriteProviderStats
 *
 * Fires on any write to `bookings/{bookingId}`. Keeps the
 * pre-aggregated stats + clients collections in sync with the
 * source-of-truth bookings — so the /pro/statistiques and
 * /pro/clients pages can read pre-computed docs at fixed cost
 * regardless of history depth.
 *
 * Strategy: re-aggregate the affected slices from scratch rather
 * than apply incremental diffs. For each booking write we:
 *
 *   1. Identify affected day(s) — usually 1, but 2 if datetime
 *      changed (old day + new day).
 *   2. Re-read all bookings for (provider, day) — small query
 *      (~50 docs/day max for a heavy provider) — run the daily
 *      aggregator on that subset, write the resulting daily doc.
 *   3. Recompute the monthly doc from all dailies of that month.
 *   4. Re-aggregate the affected client's full history and write
 *      providerClients.
 *
 * Rolling snapshots (top-K, heatmap) are NOT touched here — the
 * nightly cron handles them. Stale-by-up-to-24h is acceptable for
 * those panels.
 *
 * Idempotency: writing the same day twice produces the same doc
 * (the aggregator is deterministic). Retries are safe.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  aggregateBookingsToClients,
  aggregateBookingsToDaily,
  aggregateDailiesToMonthly,
  bookingFromFirestore,
  clientDocId,
  dailyDocId,
  dateKeyInTz,
  getClientKey,
  monthKeyInTz,
  monthlyDocId,
  type BookingLike,
  type ProviderStatsDaily,
} from '../lib/providerStatsAgg';

const DEFAULT_TIMEZONE = 'Europe/Paris';

export const onBookingWriteProviderStats = onDocumentWritten(
  {
    document: 'bookings/{bookingId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const providerId = (after?.providerId ?? before?.providerId) as string | undefined;
    if (!providerId) return;

    try {
      // ── Identify affected days + months + clients ────────────
      const beforeBooking = before ? bookingFromFirestore(before) : null;
      const afterBooking = after ? bookingFromFirestore(after) : null;

      const days = new Set<string>();
      if (beforeBooking) days.add(dateKeyInTz(beforeBooking.datetime, DEFAULT_TIMEZONE));
      if (afterBooking) days.add(dateKeyInTz(afterBooking.datetime, DEFAULT_TIMEZONE));

      const months = new Set<string>();
      for (const d of days) months.add(d.slice(0, 7));

      const clientKeys = new Set<string>();
      if (beforeBooking) {
        const k = getClientKey(beforeBooking);
        if (k !== 'anonymous') clientKeys.add(k);
      }
      if (afterBooking) {
        const k = getClientKey(afterBooking);
        if (k !== 'anonymous') clientKeys.add(k);
      }

      // ── Fetch provider context (name + members) once ─────────
      const ctx = await loadProviderContext(providerId);
      if (!ctx) {
        console.warn(`[onBookingWriteProviderStats] provider ${providerId} not found`);
        return;
      }

      // ── Re-aggregate each affected day ───────────────────────
      for (const date of days) {
        await recomputeDailyDoc(providerId, date, ctx);
      }

      // ── Re-aggregate each affected month ─────────────────────
      // We do this by reading all dailies of the month and rolling
      // them up. Cheaper than re-aggregating from raw bookings of
      // the whole month.
      for (const month of months) {
        await recomputeMonthlyDoc(providerId, month);
      }

      // ── Re-aggregate each affected client (CRM doc) ──────────
      for (const clientKey of clientKeys) {
        await recomputeClientDoc(providerId, clientKey, ctx);
      }
    } catch (err) {
      console.error('[onBookingWriteProviderStats] failed', err);
      // Don't rethrow — the trigger is best-effort and a failure
      // here should not block other booking-write side effects.
    }
  },
);

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

interface ProviderContext {
  providerName: string;
  membersById: Record<string, { name: string }>;
}

async function loadProviderContext(providerId: string): Promise<ProviderContext | null> {
  const db = admin.firestore();
  const [providerSnap, membersSnap] = await Promise.all([
    db.doc(`providers/${providerId}`).get(),
    db.collection(`providers/${providerId}/members`).get(),
  ]);
  if (!providerSnap.exists) return null;
  const providerData = providerSnap.data() ?? {};
  const membersById: Record<string, { name: string }> = {};
  for (const m of membersSnap.docs) {
    const d = m.data();
    membersById[m.id] = { name: (d.name as string) ?? '—' };
  }
  return {
    providerName: (providerData.businessName as string) ?? 'Provider',
    membersById,
  };
}

function dayBounds(date: string): { start: Date; end: Date } {
  // We treat the day in the provider's timezone but Firestore
  // stores datetime in UTC. dateKeyInTz already accounts for this
  // when the data goes IN; for the OUT query we widen the window
  // by 24h on each side to catch all bookings whose Europe/Paris
  // calendar date matches `date`. The aggregator filters again by
  // dateKeyInTz so over-fetching is harmless.
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d - 1)); // -1 day buffer
  const end = new Date(Date.UTC(y, m - 1, d + 2));   // +1 day buffer
  return { start, end };
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 2, 1)); // previous month for tz buffer
  const end = new Date(Date.UTC(y, m + 1, 1));   // next month for tz buffer
  return { start, end };
}

async function recomputeDailyDoc(
  providerId: string,
  date: string,
  ctx: ProviderContext,
): Promise<void> {
  const db = admin.firestore();
  const { start, end } = dayBounds(date);
  const snap = await db
    .collection('bookings')
    .where('providerId', '==', providerId)
    .where('datetime', '>=', Timestamp.fromDate(start))
    .where('datetime', '<', Timestamp.fromDate(end))
    .get();

  const bookings: BookingLike[] = snap.docs.map((d) => bookingFromFirestore(d.data()));
  const dailies = aggregateBookingsToDaily(bookings, {
    providerId,
    providerName: ctx.providerName,
    membersById: ctx.membersById,
    timezone: DEFAULT_TIMEZONE,
  });

  const daily = dailies.get(date);
  const ref = db.collection('providerStatsDaily').doc(dailyDocId(providerId, date));
  if (daily) {
    await ref.set(daily, { merge: false });
  } else {
    // No bookings remain on that day → delete the doc.
    await ref.delete().catch(() => undefined);
  }
}

async function recomputeMonthlyDoc(
  providerId: string,
  month: string,
): Promise<void> {
  const db = admin.firestore();
  // Sum existing daily docs for this month — far cheaper than
  // re-querying raw bookings of the whole month. Daily docs are
  // already up to date because we just wrote the affected one.
  const snap = await db
    .collection('providerStatsDaily')
    .where('providerId', '==', providerId)
    .where('date', '>=', `${month}-01`)
    .where('date', '<', nextMonthKey(month) + '-01')
    .get();

  const dailies: ProviderStatsDaily[] = snap.docs.map((d) => d.data() as ProviderStatsDaily);
  // Hydrate any Timestamp into Date — daily docs were written by
  // us so most fields are Dates already; defensive only.
  for (const d of dailies) {
    if ((d.updatedAt as unknown) instanceof Timestamp) {
      d.updatedAt = (d.updatedAt as unknown as Timestamp).toDate();
    }
  }

  const monthlies = aggregateDailiesToMonthly(dailies, providerId);
  const monthly = monthlies.get(month);
  const ref = db.collection('providerStatsMonthly').doc(monthlyDocId(providerId, month));
  if (monthly) {
    await ref.set(monthly, { merge: false });
  } else {
    await ref.delete().catch(() => undefined);
  }
}

function nextMonthKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

async function recomputeClientDoc(
  providerId: string,
  clientKey: string,
  ctx: ProviderContext,
): Promise<void> {
  const db = admin.firestore();
  // Pull every booking from that client to this provider. The
  // clientKey is `email:foo@bar.com` or `id:userId`. Both shapes
  // are queryable on bookings via clientInfo.email / clientId.
  const [, value] = clientKey.split(':');
  let snap;
  if (clientKey.startsWith('email:')) {
    snap = await db
      .collection('bookings')
      .where('providerId', '==', providerId)
      .where('clientInfo.email', '==', value)
      .get();
  } else {
    snap = await db
      .collection('bookings')
      .where('providerId', '==', providerId)
      .where('clientId', '==', value)
      .get();
  }

  const bookings: BookingLike[] = snap.docs.map((d) => bookingFromFirestore(d.data()));

  // Optional: enrich registered users for canonical name/photo.
  const registeredUsers: Record<string, { displayName: string; photoURL: string | null; phone: string | null }> = {};
  if (clientKey.startsWith('id:') && bookings.length > 0) {
    const userId = clientKey.slice(3);
    const userSnap = await db.doc(`users/${userId}`).get();
    if (userSnap.exists) {
      const u = userSnap.data() ?? {};
      registeredUsers[userId] = {
        displayName: (u.displayName as string) ?? '',
        photoURL: (u.photoURL as string | null) ?? null,
        phone: (u.phone as string | null) ?? null,
      };
    }
  }

  const clients = aggregateBookingsToClients(
    bookings,
    { providerId, registeredUsers },
  );
  const client = clients.get(clientKey);
  const ref = db.collection('providerClients').doc(clientDocId(providerId, clientKey));
  if (client) {
    await ref.set(client, { merge: false });
  } else {
    await ref.delete().catch(() => undefined);
  }

  // Touch ctx to keep linter happy — context is loaded for symmetry
  // with the daily/monthly path even though clients don't need
  // per-member denormalisation (yet).
  void ctx;
}

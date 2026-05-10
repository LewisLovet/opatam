/**
 * Shared recompute helpers for the provider-stats pipeline.
 *
 * Two triggers feed this pipeline:
 *   1. onBookingWriteProviderStats — fires on bookings/{id} writes
 *   2. onBlockedSlotWriteProviderStats — fires on
 *      providers/{providerId}/blockedSlots/{id} writes (paid activities)
 *
 * Both need the same "given a (provider, day), re-aggregate the daily
 * doc by re-fetching bookings + paid activities and running the
 * aggregator from scratch" logic. Pulled into this shared module so a
 * change in one place propagates to both triggers.
 *
 * Strategy stays the same as the original booking trigger:
 * idempotent re-aggregation rather than incremental diffs. Replaying
 * the same write produces the same daily doc (the aggregator is pure
 * and deterministic).
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  aggregateBookingsToDaily,
  aggregateDailiesToMonthly,
  bookingFromFirestore,
  dailyDocId,
  mergeActivitiesIntoDailies,
  monthlyDocId,
  type BlockedSlotLike,
  type BookingLike,
  type ProviderStatsDaily,
} from './providerStatsAgg';

export const DEFAULT_TIMEZONE = 'Europe/Paris';

export interface ProviderContext {
  providerName: string;
  membersById: Record<string, { name: string }>;
}

/**
 * Load the provider's display name + member roster. Used by the
 * daily aggregator so denormalised member names on the daily doc
 * reflect the *current* member name (handy when a member was
 * renamed since their bookings were created).
 */
export async function loadProviderContext(
  providerId: string,
): Promise<ProviderContext | null> {
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

/**
 * Provider-timezone-safe day bounds. We treat the day in the
 * provider's timezone but Firestore stores datetime in UTC, so we
 * widen the query window by 24h on each side to catch all entries
 * whose Europe/Paris calendar date matches `date`. The aggregator
 * filters again by `dateKeyInTz` so the over-fetch is harmless.
 */
export function dayBounds(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d - 1)); // -1 day buffer
  const end = new Date(Date.UTC(y, m - 1, d + 2));   // +1 day buffer
  return { start, end };
}

export function nextMonthKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Hydrate a blockedSlot Firestore raw doc into the shape the
 * aggregator expects (Timestamp → Date). Only the three fields
 * we touch are normalised; the rest is ignored.
 */
export function blockedSlotFromFirestore(
  raw: FirebaseFirestore.DocumentData,
): BlockedSlotLike {
  const startDate = raw.startDate instanceof Timestamp
    ? raw.startDate.toDate()
    : (raw.startDate as Date);
  return {
    category: (raw.category ?? null) as BlockedSlotLike['category'],
    amount: typeof raw.amount === 'number' ? raw.amount : null,
    startDate,
  };
}

/**
 * Re-aggregate the daily doc for a given (provider, date) from
 * scratch — fetch all bookings + paid activities for that day,
 * run them through the aggregator, write the resulting doc.
 *
 * Both data sources are fetched in parallel since they're
 * independent collections. Activities are filtered in-memory to
 * those with `category` set AND `amount > 0` — the per-day count
 * is small, no need for a Firestore composite index.
 */
export async function recomputeDailyDoc(
  providerId: string,
  date: string,
  ctx: ProviderContext,
): Promise<void> {
  const db = admin.firestore();
  const { start, end } = dayBounds(date);

  const [bookingSnap, activitiesSnap] = await Promise.all([
    db
      .collection('bookings')
      .where('providerId', '==', providerId)
      .where('datetime', '>=', Timestamp.fromDate(start))
      .where('datetime', '<', Timestamp.fromDate(end))
      .get(),
    db
      .collection(`providers/${providerId}/blockedSlots`)
      .where('startDate', '>=', Timestamp.fromDate(start))
      .where('startDate', '<', Timestamp.fromDate(end))
      .get(),
  ]);

  const bookings: BookingLike[] = bookingSnap.docs.map((d) =>
    bookingFromFirestore(d.data()),
  );
  const activities: BlockedSlotLike[] = activitiesSnap.docs
    .map((d) => blockedSlotFromFirestore(d.data()))
    .filter((s) => !!s.category && (s.amount ?? 0) > 0);

  const dailies = aggregateBookingsToDaily(bookings, {
    providerId,
    providerName: ctx.providerName,
    membersById: ctx.membersById,
    timezone: DEFAULT_TIMEZONE,
  });
  if (activities.length > 0) {
    mergeActivitiesIntoDailies(activities, dailies, {
      providerId,
      timezone: DEFAULT_TIMEZONE,
    });
  }

  const daily = dailies.get(date);
  const ref = db.collection('providerStatsDaily').doc(dailyDocId(providerId, date));
  if (daily) {
    await ref.set(daily, { merge: false });
  } else {
    // No bookings AND no paid activities remain on that day → delete the doc.
    await ref.delete().catch(() => undefined);
  }
}

/**
 * Re-aggregate the monthly doc for a given (provider, month) by
 * summing the existing daily docs of that month. Cheaper than
 * re-querying raw bookings — daily docs are always up to date
 * because the day-level recompute runs first.
 */
export async function recomputeMonthlyDoc(
  providerId: string,
  month: string,
): Promise<void> {
  const db = admin.firestore();
  const snap = await db
    .collection('providerStatsDaily')
    .where('providerId', '==', providerId)
    .where('date', '>=', `${month}-01`)
    .where('date', '<', nextMonthKey(month) + '-01')
    .get();

  const dailies: ProviderStatsDaily[] = snap.docs.map(
    (d) => d.data() as ProviderStatsDaily,
  );
  // Hydrate any Timestamp into Date — daily docs were written by us
  // so most fields are Dates already; defensive only.
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

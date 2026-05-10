/**
 * Trigger: onBlockedSlotWriteProviderStats
 *
 * Mirror of `onBookingWriteProviderStats` for the "Autres revenus"
 * track — fires on any write to
 *   providers/{providerId}/blockedSlots/{blockedSlotId}
 *
 * Activities (BlockedSlot entries with `category` set + `amount > 0`)
 * contribute to the daily/monthly stats docs alongside bookings,
 * tracked separately so the UI can show CA RDV vs Autres revenus
 * side by side. See packages/shared/src/utils/providerStats.ts for
 * the aggregation contract.
 *
 * Strategy: re-aggregate the affected day(s) from scratch — same
 * idempotent pattern the booking trigger uses. The shared
 * `recomputeDailyDoc` helper re-fetches BOTH bookings and paid
 * activities for the affected day, so the resulting daily doc is
 * correct regardless of which collection triggered the recompute.
 *
 * Days touched:
 *   - the `startDate` of the slot before the write (if any)
 *   - the `startDate` of the slot after the write (if any)
 *
 * We don't bother with `endDate` — activities are all-day or
 * intra-day, never spanning days in practice (same-day startDate
 * == endDate). If that ever changes the recompute would just need
 * to enumerate every day in the range.
 *
 * No-op fast-path: if neither side has a `category` (this is a
 * plain blocked period, e.g. vacation) AND no amount, skip the
 * recompute entirely. Saves the round-trip on the common case.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  DEFAULT_TIMEZONE,
  loadProviderContext,
  recomputeDailyDoc,
  recomputeMonthlyDoc,
} from '../lib/providerStatsRecompute';
import { dateKeyInTz } from '../lib/providerStatsAgg';

interface BlockedSlotRaw {
  category?: string | null;
  amount?: number | null;
  startDate?: Timestamp | Date;
}

export const onBlockedSlotWriteProviderStats = onDocumentWritten(
  {
    document: 'providers/{providerId}/blockedSlots/{blockedSlotId}',
    region: 'europe-west1',
  },
  async (event) => {
    const providerId = event.params.providerId as string;
    const before = event.data?.before?.data() as BlockedSlotRaw | undefined;
    const after = event.data?.after?.data() as BlockedSlotRaw | undefined;

    // Fast-path: neither version is a paid activity (no category or
    // no amount on either side). Stats don't care about plain
    // blocked periods (vacations, etc.) — skip the recompute.
    const beforePaid = !!before?.category && (before.amount ?? 0) > 0;
    const afterPaid = !!after?.category && (after.amount ?? 0) > 0;
    if (!beforePaid && !afterPaid) return;

    try {
      // Identify affected days. `startDate` is what the aggregator
      // uses as the day key, so we only care about that field.
      const days = new Set<string>();
      if (beforePaid) {
        const d = toDate(before!.startDate);
        if (d) days.add(dateKeyInTz(d, DEFAULT_TIMEZONE));
      }
      if (afterPaid) {
        const d = toDate(after!.startDate);
        if (d) days.add(dateKeyInTz(d, DEFAULT_TIMEZONE));
      }
      if (days.size === 0) return;

      const months = new Set<string>();
      for (const d of days) months.add(d.slice(0, 7));

      const ctx = await loadProviderContext(providerId);
      if (!ctx) {
        console.warn(`[onBlockedSlotWriteProviderStats] provider ${providerId} not found`);
        return;
      }

      for (const date of days) {
        await recomputeDailyDoc(providerId, date, ctx);
      }
      for (const month of months) {
        await recomputeMonthlyDoc(providerId, month);
      }
    } catch (err) {
      console.error('[onBlockedSlotWriteProviderStats] failed', err);
      // Best-effort — never throw, otherwise the activity write
      // ends up retrying the trigger forever.
    }
  },
);

/** Defensive Timestamp/Date coercion. Returns null if neither shape. */
function toDate(raw: Timestamp | Date | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (raw instanceof Timestamp) return raw.toDate();
  // Some test fixtures or older rows may serialise as `{ seconds, nanoseconds }`.
  // The Admin SDK normally hydrates these into Timestamp instances, but be safe.
  const maybeSeconds = (raw as { seconds?: number }).seconds;
  if (typeof maybeSeconds === 'number') return new Date(maybeSeconds * 1000);
  return null;
}

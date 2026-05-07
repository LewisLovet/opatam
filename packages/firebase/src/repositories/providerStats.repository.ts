/**
 * Provider stats repository — read-only access for the
 * /pro/statistiques dashboard.
 *
 * The collections themselves are populated by:
 *   - functions/src/triggers/onBookingWriteProviderStats (live updates)
 *   - functions/src/scheduled/recomputeProviderStats     (nightly cron)
 *   - functions/src/callable/runProviderStatsBackfill    (initial load)
 *
 * Client-side writes are forbidden by the Firestore rules. This
 * repo only exposes reads.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseApp } from '../lib/config';
import type {
  ProviderStatsDaily,
  ProviderStatsMonthly,
  ProviderStatsRolling,
} from '@booking-app/shared';

type WithId<T> = { id: string } & T;

class ProviderStatsRepository {
  private db() {
    return getFirestore(getFirebaseApp());
  }

  /**
   * Daily docs for a provider over a closed range, both ends
   * inclusive. Dates are YYYY-MM-DD strings (the same key used
   * inside the doc id). Returns the docs sorted ascending by date,
   * which is what the chart and KPI components expect.
   *
   * Empty range or no docs → empty array.
   */
  async getDailiesInRange(
    providerId: string,
    startDate: string,
    endDate: string,
  ): Promise<WithId<ProviderStatsDaily>[]> {
    const q = query(
      collection(this.db(), 'providerStatsDaily'),
      where('providerId', '==', providerId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as ProviderStatsDaily),
    }));
  }

  /**
   * Monthly docs over a closed range. Months are YYYY-MM strings.
   * Used by the 12-month trend chart.
   */
  async getMonthliesInRange(
    providerId: string,
    startMonth: string,
    endMonth: string,
  ): Promise<WithId<ProviderStatsMonthly>[]> {
    const q = query(
      collection(this.db(), 'providerStatsMonthly'),
      where('providerId', '==', providerId),
      where('month', '>=', startMonth),
      where('month', '<=', endMonth),
      orderBy('month', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as ProviderStatsMonthly),
    }));
  }

  /**
   * Single rolling snapshot doc — top-K services / clients per
   * window + 90-day heatmap. Doc id is the providerId itself
   * (no composite suffix). Returns null if the provider has no
   * rolling doc yet (ran the backfill but cron hasn't ticked,
   * or no bookings at all).
   */
  async getRolling(
    providerId: string,
  ): Promise<WithId<ProviderStatsRolling> | null> {
    const ref = doc(this.db(), 'providerStatsRolling', providerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as ProviderStatsRolling) };
  }
}

export const providerStatsRepository = new ProviderStatsRepository();
export { ProviderStatsRepository };

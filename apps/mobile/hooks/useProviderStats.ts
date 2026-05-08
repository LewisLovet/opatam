/**
 * useProviderStats Hook — period-aware version.
 *
 * Reads from the pre-aggregated stats collections to compute KPIs
 * for a selected period (7j / 30j / 90j / 12m), plus the same KPIs
 * over the previous period of the same length (for delta arrows).
 *
 * Cost per call:
 *  - 7d / 30d / 90d → 2 × N daily docs (current + previous, max
 *    ~180 docs total for 90d × 2)
 *  - 12m → 2 × 12 monthly docs (24 docs)
 *  - + 2 page-view queries on pageViewsDaily or pageViewsMonthly
 *
 * Independent of how many bookings the provider has — bounded by
 * the period, not by history depth.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { app, providerStatsRepository } from '@booking-app/firebase';
import {
  periodBounds,
  totalsFromDailies,
  totalsFromMonthlies,
  type Period,
  type ProviderStatsDaily,
  type ProviderStatsMonthly,
} from '@booking-app/shared';

export type { Period };

export interface ProviderStats {
  /** Selected period (echoed for convenience). */
  period: Period;

  // ── Current period ──
  revenue: number;
  bookingsCount: number;
  uniqueClients: number;
  pageViews: number;
  // Status breakdown for the period
  pendingCount: number;
  confirmedCount: number;
  cancelledCount: number;
  noshowCount: number;
  /** % of confirmed bookings that weren't cancelled/no-show. */
  completionRate: number;

  // ── Previous period totals (for delta arrows) ──
  revenuePrevious: number;
  bookingsCountPrevious: number;
  uniqueClientsPrevious: number;
  pageViewsPrevious: number;
}

export interface UseProviderStatsResult {
  stats: ProviderStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_STATS = (period: Period): ProviderStats => ({
  period,
  revenue: 0,
  bookingsCount: 0,
  uniqueClients: 0,
  pageViews: 0,
  pendingCount: 0,
  confirmedCount: 0,
  cancelledCount: 0,
  noshowCount: 0,
  completionRate: 0,
  revenuePrevious: 0,
  bookingsCountPrevious: 0,
  uniqueClientsPrevious: 0,
  pageViewsPrevious: 0,
});

export function useProviderStats(
  providerId: string | null,
  period: Period = '30d',
): UseProviderStatsResult {
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!providerId) {
      setStats(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);

      const bounds = periodBounds(period);

      // Fetch in parallel — same shape as the web stats page. Each
      // helper is wrapped in try/catch downstream so a single
      // failure (e.g. missing index, transient blip) doesn't blank
      // the whole result.
      const [
        dailies,
        dailiesPrev,
        monthlies,
        monthliesPrev,
        pvCurrent,
        pvPrevious,
      ] = await Promise.all([
        bounds.granularity === 'daily'
          ? safe(() => providerStatsRepository.getDailiesInRange(providerId, bounds.start, bounds.end), [] as ProviderStatsDaily[])
          : Promise.resolve([] as ProviderStatsDaily[]),
        bounds.granularity === 'daily'
          ? safe(() => providerStatsRepository.getDailiesInRange(providerId, bounds.prevStart, bounds.prevEnd), [] as ProviderStatsDaily[])
          : Promise.resolve([] as ProviderStatsDaily[]),
        bounds.granularity === 'monthly' && bounds.startMonth && bounds.endMonth
          ? safe(() => providerStatsRepository.getMonthliesInRange(providerId, bounds.startMonth!, bounds.endMonth!), [] as ProviderStatsMonthly[])
          : Promise.resolve([] as ProviderStatsMonthly[]),
        bounds.granularity === 'monthly' && bounds.prevStartMonth && bounds.prevEndMonth
          ? safe(() => providerStatsRepository.getMonthliesInRange(providerId, bounds.prevStartMonth!, bounds.prevEndMonth!), [] as ProviderStatsMonthly[])
          : Promise.resolve([] as ProviderStatsMonthly[]),
        safe(
          () =>
            bounds.granularity === 'daily'
              ? sumPageViewsDaily(providerId, bounds.start, bounds.end)
              : sumPageViewsMonthly(providerId, bounds.startMonth!, bounds.endMonth!),
          0,
        ),
        safe(
          () =>
            bounds.granularity === 'daily'
              ? sumPageViewsDaily(providerId, bounds.prevStart, bounds.prevEnd)
              : sumPageViewsMonthly(providerId, bounds.prevStartMonth!, bounds.prevEndMonth!),
          0,
        ),
      ]);

      const isMonthly = bounds.granularity === 'monthly';
      const totals = isMonthly
        ? totalsFromMonthlies(monthlies)
        : totalsFromDailies(dailies);
      const totalsPrev = isMonthly
        ? totalsFromMonthlies(monthliesPrev)
        : totalsFromDailies(dailiesPrev);

      const completionRate = totals.bookingsCount === 0
        ? 0
        : Math.round(((totals.bookingsCount - totals.cancelledCount - totals.noshowCount) / totals.bookingsCount) * 100);

      setStats({
        period,
        revenue: totals.revenue,
        bookingsCount: totals.bookingsCount,
        uniqueClients: totals.uniqueClients,
        pageViews: pvCurrent,
        pendingCount: 0, // pending isn't in PeriodTotals — keep 0 for now, surface later if needed
        confirmedCount: totals.confirmedCount,
        cancelledCount: totals.cancelledCount,
        noshowCount: totals.noshowCount,
        completionRate,
        revenuePrevious: totalsPrev.revenue,
        bookingsCountPrevious: totalsPrev.bookingsCount,
        uniqueClientsPrevious: totalsPrev.uniqueClients,
        pageViewsPrevious: pvPrevious,
      });
    } catch (err) {
      console.error('[useProviderStats] error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setStats(EMPTY_STATS(period));
    } finally {
      setIsLoading(false);
    }
  }, [providerId, period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, isLoading, error, refresh };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.warn('[useProviderStats] query failed, using fallback:', err);
    return fallback;
  }
}

async function sumPageViewsDaily(
  providerId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const db = getFirestore(app);
  const q = query(
    collection(db, 'pageViewsDaily'),
    where('providerId', '==', providerId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc'),
  );
  const snap = await getDocs(q);
  let total = 0;
  for (const d of snap.docs) total += (d.data().count as number) ?? 0;
  return total;
}

async function sumPageViewsMonthly(
  providerId: string,
  startMonth: string,
  endMonth: string,
): Promise<number> {
  const db = getFirestore(app);
  const q = query(
    collection(db, 'pageViewsMonthly'),
    where('providerId', '==', providerId),
    where('month', '>=', startMonth),
    where('month', '<=', endMonth),
    orderBy('month', 'asc'),
  );
  const snap = await getDocs(q);
  let total = 0;
  for (const d of snap.docs) total += (d.data().count as number) ?? 0;
  return total;
}

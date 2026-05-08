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
import {
  app,
  providerClientRepository,
  providerStatsRepository,
} from '@booking-app/firebase';
import {
  buildContinuousTrend,
  periodBounds,
  topServicesFromDailies,
  totalsFromDailies,
  totalsFromMonthlies,
  trendFromDailies,
  trendFromMonthlies,
  type Period,
  type ProviderStatsDaily,
  type ProviderStatsMonthly,
  type ProviderStatsRolling,
  type ProviderStatsServiceBreakdown,
  type TrendPoint,
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

  // ── Continuous trend over the period (for charts) ──
  /** One entry per bucket (day for ≤90j, month for 12m), gap-free. */
  trend: TrendPoint[];
  /** Bar for 7-day view, smoothed line for 30/90/12m. */
  chartType: 'bar' | 'line';

  // ── Top-K + heatmap ──
  topServices: ProviderStatsServiceBreakdown[];
  /** Top clients with names resolved from providerClients (when available). */
  topClients: {
    clientHash: string;
    bookingsCount: number;
    revenue: number;
    name?: string;
  }[];
  /** Period-independent heatmap (always 90d). null when no rolling doc yet. */
  heatmap90d: number[] | null;

  // ── Quality indicators (derived) ──
  cancellationRate: number; // 0..1
  noshowRate: number;       // 0..1
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
  trend: [],
  chartType: period === '7d' ? 'bar' : 'line',
  topServices: [],
  topClients: [],
  heatmap90d: null,
  cancellationRate: 0,
  noshowRate: 0,
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
        rolling,
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
              ? readPageViewsDaily(providerId, bounds.start, bounds.end)
              : readPageViewsMonthly(providerId, bounds.startMonth!, bounds.endMonth!),
          { byKey: new Map<string, number>(), total: 0 },
        ),
        safe(
          () =>
            bounds.granularity === 'daily'
              ? readPageViewsDaily(providerId, bounds.prevStart, bounds.prevEnd)
              : readPageViewsMonthly(providerId, bounds.prevStartMonth!, bounds.prevEndMonth!),
          { byKey: new Map<string, number>(), total: 0 },
        ),
        safe<ProviderStatsRolling | null>(
          () => providerStatsRepository.getRolling(providerId),
          null,
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

      // Build the gap-free trend by merging bookings + pageViews
      // by date/month key. Days with no data render as a 0-bar /
      // 0-point so the timeline stays continuous.
      const bookingTrend = isMonthly
        ? trendFromMonthlies(monthlies)
        : trendFromDailies(dailies);
      const trend = buildContinuousTrend(
        bounds.start,
        bounds.end,
        bounds.granularity,
        bookingTrend,
        pvCurrent.byKey,
      );

      // Top services — for 7d we compute from dailies; otherwise
      // pull the matching window from the rolling snapshot.
      let topServices: ProviderStatsServiceBreakdown[] = [];
      if (period === '7d') {
        topServices = topServicesFromDailies(dailies);
      } else if (rolling) {
        topServices =
          period === '30d'
            ? rolling.topServices30d
            : period === '90d'
              ? rolling.topServices90d
              : rolling.topServicesAllTime;
      }

      // Top clients — rolling carries hashes for privacy. Resolve
      // names by pulling the matching providerClients docs (max
      // ~30 reads, 10 per window cumulative). Fail-soft: missing
      // doc → tooltip uses the masked hash.
      const topClientsRaw = rolling
        ? period === '7d' || period === '30d'
          ? rolling.topClients30d
          : period === '90d'
            ? rolling.topClients90d
            : rolling.topClientsAllTime
        : [];
      const clientHashes = topClientsRaw.map((c) => c.clientHash);
      const nameByHash = clientHashes.length > 0
        ? await safe(
            async () => {
              const map = await providerClientRepository.getByKeys(
                providerId,
                clientHashes,
              );
              const out = new Map<string, string>();
              for (const c of map.values()) out.set(c.clientKey, c.name);
              return out;
            },
            new Map<string, string>(),
          )
        : new Map<string, string>();
      const topClients = topClientsRaw.map((c) => ({
        ...c,
        name: nameByHash.get(c.clientHash),
      }));

      // Quality indicators derived from totals.
      const cancellationRate = totals.bookingsCount === 0
        ? 0
        : totals.cancelledCount / totals.bookingsCount;
      const noshowRate = totals.bookingsCount === 0
        ? 0
        : totals.noshowCount / totals.bookingsCount;

      setStats({
        period,
        revenue: totals.revenue,
        bookingsCount: totals.bookingsCount,
        uniqueClients: totals.uniqueClients,
        pageViews: pvCurrent.total,
        pendingCount: 0, // pending isn't in PeriodTotals — keep 0 for now, surface later if needed
        confirmedCount: totals.confirmedCount,
        cancelledCount: totals.cancelledCount,
        noshowCount: totals.noshowCount,
        completionRate,
        revenuePrevious: totalsPrev.revenue,
        bookingsCountPrevious: totalsPrev.bookingsCount,
        uniqueClientsPrevious: totalsPrev.uniqueClients,
        pageViewsPrevious: pvPrevious.total,
        trend,
        chartType: period === '7d' ? 'bar' : 'line',
        topServices,
        topClients,
        heatmap90d: rolling?.heatmap90d ?? null,
        cancellationRate,
        noshowRate,
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

/**
 * Read page views with the per-bucket breakdown (for chart) AND
 * the total sum (for the KPI card delta) — one query, two outputs.
 */
async function readPageViewsDaily(
  providerId: string,
  startDate: string,
  endDate: string,
): Promise<{ byKey: Map<string, number>; total: number }> {
  const db = getFirestore(app);
  const q = query(
    collection(db, 'pageViewsDaily'),
    where('providerId', '==', providerId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc'),
  );
  const snap = await getDocs(q);
  const byKey = new Map<string, number>();
  let total = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const date = data.date as string;
    const count = (data.count as number) ?? 0;
    if (date) byKey.set(date, count);
    total += count;
  }
  return { byKey, total };
}

async function readPageViewsMonthly(
  providerId: string,
  startMonth: string,
  endMonth: string,
): Promise<{ byKey: Map<string, number>; total: number }> {
  const db = getFirestore(app);
  const q = query(
    collection(db, 'pageViewsMonthly'),
    where('providerId', '==', providerId),
    where('month', '>=', startMonth),
    where('month', '<=', endMonth),
    orderBy('month', 'asc'),
  );
  const snap = await getDocs(q);
  const byKey = new Map<string, number>();
  let total = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const month = data.month as string;
    const count = (data.count as number) ?? 0;
    if (month) byKey.set(month, count);
    total += count;
  }
  return { byKey, total };
}

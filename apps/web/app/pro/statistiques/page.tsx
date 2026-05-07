'use client';

/**
 * /pro/statistiques — provider business dashboard.
 *
 * Reads from the pre-aggregated collections populated by the Phase 1B
 * pipeline:
 *  - providerStatsDaily / providerStatsMonthly  → period sums + trend chart
 *  - providerStatsRolling                       → top services / top clients / heatmap
 *  - providerClients                            → resolves top-client names
 *  - pageViewsDaily                             → vitrine views over the period
 *
 * Cost per page load: bounded — at most ~60 daily docs (30j × 2 for
 * delta), or 24 monthly docs (12m × 2), + 1 rolling, + N tiny client
 * lookups for the top-K names. Period change triggers a refetch.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  app,
  providerClientRepository,
  providerStatsRepository,
} from '@booking-app/firebase';
import type {
  ProviderStatsDaily,
  ProviderStatsMonthly,
  ProviderStatsRolling,
  ProviderStatsServiceBreakdown,
} from '@booking-app/shared';
import { Loader } from '@/components/ui';
import { PeriodPills } from './components/PeriodPills';
import { KpiBar } from './components/KpiBar';
import { RevenueTrendChart } from './components/RevenueTrendChart';
import { TopServicesPanel } from './components/TopServicesPanel';
import { TopClientsPanel } from './components/TopClientsPanel';
import { HeatmapPanel } from './components/HeatmapPanel';
import { QualityIndicators } from './components/QualityIndicators';
import { periodBounds, type Period } from './lib/period';
import {
  topServicesFromDailies,
  totalsFromDailies,
  totalsFromMonthlies,
  trendFromDailies,
  trendFromMonthlies,
} from './lib/aggregate';

interface State {
  loading: boolean;
  error: string | null;
  period: Period;
  // Current period
  dailies: ProviderStatsDaily[];
  monthlies: ProviderStatsMonthly[];
  pageViewsCurrent: number;
  // Previous period (for deltas)
  dailiesPrev: ProviderStatsDaily[];
  monthliesPrev: ProviderStatsMonthly[];
  pageViewsPrevious: number;
  // Period-independent
  rolling: ProviderStatsRolling | null;
  topClientNames: Map<string, string>; // clientKey → resolved name
}

export default function StatistiquesPage() {
  const { user, provider } = useAuth();
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    period: '30d',
    dailies: [],
    monthlies: [],
    pageViewsCurrent: 0,
    dailiesPrev: [],
    monthliesPrev: [],
    pageViewsPrevious: 0,
    rolling: null,
    topClientNames: new Map(),
  });

  // ── Fetch on mount + period change ─────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const providerId = user.id;
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));

      const bounds = periodBounds(state.period);

      // Per-query resilient fetch. If one query fails (e.g. an
      // index still building, a missing rule), we log it and fall
      // back to a sane default so the rest of the page still
      // renders. Avoids the all-or-nothing Promise.all behaviour
      // that made a single failure blank the entire dashboard.
      const safe = async <T,>(
        name: string,
        run: () => Promise<T>,
        fallback: T,
      ): Promise<T> => {
        try {
          return await run();
        } catch (err) {
          if (!cancelled) {
            console.error(`[statistiques] query "${name}" failed:`, err);
          }
          return fallback;
        }
      };

      const [
        dailies,
        dailiesPrev,
        monthlies,
        monthliesPrev,
        rolling,
        pageViewsCurrent,
        pageViewsPrevious,
      ] = await Promise.all([
        bounds.granularity === 'daily'
          ? safe(
              'dailies (current)',
              () => providerStatsRepository.getDailiesInRange(providerId, bounds.start, bounds.end),
              [] as ProviderStatsDaily[],
            )
          : Promise.resolve([] as ProviderStatsDaily[]),
        bounds.granularity === 'daily'
          ? safe(
              'dailies (previous)',
              () => providerStatsRepository.getDailiesInRange(providerId, bounds.prevStart, bounds.prevEnd),
              [] as ProviderStatsDaily[],
            )
          : Promise.resolve([] as ProviderStatsDaily[]),
        bounds.granularity === 'monthly' && bounds.startMonth && bounds.endMonth
          ? safe(
              'monthlies (current)',
              () => providerStatsRepository.getMonthliesInRange(providerId, bounds.startMonth!, bounds.endMonth!),
              [] as ProviderStatsMonthly[],
            )
          : Promise.resolve([] as ProviderStatsMonthly[]),
        bounds.granularity === 'monthly' && bounds.prevStartMonth && bounds.prevEndMonth
          ? safe(
              'monthlies (previous)',
              () => providerStatsRepository.getMonthliesInRange(providerId, bounds.prevStartMonth!, bounds.prevEndMonth!),
              [] as ProviderStatsMonthly[],
            )
          : Promise.resolve([] as ProviderStatsMonthly[]),
        safe('rolling', () => providerStatsRepository.getRolling(providerId), null),
        safe('pageViews (current)', () => sumPageViewsInRange(providerId, bounds.start, bounds.end), 0),
        safe('pageViews (previous)', () => sumPageViewsInRange(providerId, bounds.prevStart, bounds.prevEnd), 0),
      ]);

      // Resolve top-client names — the rolling doc only carries
      // hashes for privacy. Wrapped in `safe` too so a permission
      // hiccup on providerClients doesn't blank the page.
      let topClientNames = new Map<string, string>();
      if (rolling) {
        const allTopHashes = new Set<string>();
        for (const c of rolling.topClients30d ?? []) allTopHashes.add(c.clientHash);
        for (const c of rolling.topClients90d ?? []) allTopHashes.add(c.clientHash);
        for (const c of rolling.topClientsAllTime ?? []) allTopHashes.add(c.clientHash);
        const resolved = await safe(
          'top client names',
          () => providerClientRepository.getByKeys(providerId, [...allTopHashes]),
          new Map(),
        );
        topClientNames = new Map(
          [...resolved.values()].map((c) => [c.clientKey, c.name]),
        );
      }

      if (cancelled) return;

      setState((s) => ({
        ...s,
        loading: false,
        dailies,
        dailiesPrev,
        monthlies,
        monthliesPrev,
        rolling,
        pageViewsCurrent,
        pageViewsPrevious,
        topClientNames,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, state.period]);

  // ── Derived metrics ────────────────────────────────────────────
  const view = useMemo(() => {
    const isMonthly = state.monthlies.length > 0 || state.period === '12m';
    const totals = isMonthly
      ? totalsFromMonthlies(state.monthlies)
      : totalsFromDailies(state.dailies);
    const totalsPrev = isMonthly
      ? totalsFromMonthlies(state.monthliesPrev)
      : totalsFromDailies(state.dailiesPrev);

    const trend = isMonthly
      ? trendFromMonthlies(state.monthlies)
      : trendFromDailies(state.dailies);

    // Top services — for 7d we compute from dailies (only 7 docs)
    // because the rolling snapshot only carries 30d/90d/all-time.
    let topServices: ProviderStatsServiceBreakdown[] = [];
    if (state.period === '7d') {
      topServices = topServicesFromDailies(state.dailies);
    } else if (state.rolling) {
      topServices =
        state.period === '30d'
          ? state.rolling.topServices30d
          : state.period === '90d'
            ? state.rolling.topServices90d
            : state.rolling.topServicesAllTime;
    }

    const topClientsRaw = state.rolling
      ? state.period === '7d' || state.period === '30d'
        ? state.rolling.topClients30d
        : state.period === '90d'
          ? state.rolling.topClients90d
          : state.rolling.topClientsAllTime
      : [];
    const topClients = topClientsRaw.map((c) => ({
      ...c,
      name: state.topClientNames.get(c.clientHash),
    }));

    const cancellationRate = totals.bookingsCount === 0
      ? 0
      : totals.cancelledCount / totals.bookingsCount;
    const noshowRate = totals.bookingsCount === 0
      ? 0
      : totals.noshowCount / totals.bookingsCount;

    return {
      totals,
      totalsPrev,
      trend,
      topServices,
      topClients,
      cancellationRate,
      noshowRate,
    };
  }, [state]);

  // ── Render ─────────────────────────────────────────────────────
  if (!user?.id) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Statistiques
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            L'évolution de votre activité en un coup d'œil
          </p>
        </div>
        <PeriodPills
          value={state.period}
          onChange={(p) => setState((s) => ({ ...s, period: p }))}
        />
      </div>

      {state.loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader size="lg" />
        </div>
      ) : state.error ? (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-6 text-red-800 dark:text-red-300 text-sm">
          {state.error}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <KpiBar
            period={state.period}
            revenue={{
              current: view.totals.revenue,
              previous: view.totalsPrev.revenue,
            }}
            bookings={{
              current: view.totals.bookingsCount,
              previous: view.totalsPrev.bookingsCount,
            }}
            uniqueClients={{
              current: view.totals.uniqueClients,
              previous: view.totalsPrev.uniqueClients,
            }}
            pageViews={{
              current: state.pageViewsCurrent,
              previous: state.pageViewsPrevious,
            }}
          />

          {/* Trend chart */}
          <RevenueTrendChart data={view.trend} />

          {/* Top services + top clients side-by-side on lg+ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopServicesPanel data={view.topServices} />
            <TopClientsPanel data={view.topClients} />
          </div>

          {/* Quality indicators */}
          <QualityIndicators
            cancellationRate={view.cancellationRate}
            noshowRate={view.noshowRate}
            averageRating={provider?.rating?.average ?? null}
            ratingCount={provider?.rating?.count ?? 0}
          />

          {/* Heatmap — at the bottom, period-independent (always 90d) */}
          {state.rolling?.heatmap90d && (
            <HeatmapPanel heatmap={state.rolling.heatmap90d} />
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Inline helper: sum pageViewsDaily over a YYYY-MM-DD range
// ────────────────────────────────────────────────────────────────

async function sumPageViewsInRange(
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
  for (const d of snap.docs) {
    total += (d.data().count as number) ?? 0;
  }
  return total;
}

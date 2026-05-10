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
import { Sparkles } from 'lucide-react';
import {
  PERIOD_LABELS,
  activityBreakdownFromDailies,
  buildContinuousTrend,
  formatPrice,
  periodBounds,
  topServicesFromDailies,
  totalsFromDailies,
  totalsFromMonthlies,
  trendFromDailies,
  trendFromMonthlies,
  type Period,
} from '@booking-app/shared';
import { PeriodPills } from './components/PeriodPills';
import { KpiBar } from './components/KpiBar';
import { TrendChart, type ChartType } from './components/TrendChart';
import { TopServicesPanel } from './components/TopServicesPanel';
import { TopClientsPanel } from './components/TopClientsPanel';
import { HeatmapPanel } from './components/HeatmapPanel';
import { QualityIndicators } from './components/QualityIndicators';
import { OtherRevenuePanel } from './components/OtherRevenuePanel';

interface State {
  loading: boolean;
  error: string | null;
  period: Period;
  // Current period
  dailies: ProviderStatsDaily[];
  monthlies: ProviderStatsMonthly[];
  /** Per-bucket page-view counts for the current period — keyed
   *  by date (YYYY-MM-DD) for daily granularity or month (YYYY-MM)
   *  for the 12m view. Indexed for O(1) merge into the trend chart. */
  pageViewsByKey: Map<string, number>;
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
    pageViewsByKey: new Map(),
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
        // For 7d/30d/90d we read pageViewsDaily directly (kept for
        // 90d). For 12m we read pageViewsMonthly (kept indefinitely).
        // Either way, we get back a per-bucket map + the total sum.
        safe(
          'pageViews (current)',
          () =>
            bounds.granularity === 'daily'
              ? readPageViewsDaily(providerId, bounds.start, bounds.end)
              : readPageViewsMonthly(providerId, bounds.startMonth!, bounds.endMonth!),
          { byKey: new Map<string, number>(), total: 0 },
        ),
        safe(
          'pageViews (previous)',
          () =>
            bounds.granularity === 'daily'
              ? readPageViewsDaily(providerId, bounds.prevStart, bounds.prevEnd)
              : readPageViewsMonthly(providerId, bounds.prevStartMonth!, bounds.prevEndMonth!),
          { byKey: new Map<string, number>(), total: 0 },
        ),
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
        pageViewsByKey: pageViewsCurrent.byKey,
        pageViewsCurrent: pageViewsCurrent.total,
        pageViewsPrevious: pageViewsPrevious.total,
        topClientNames,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, state.period]);

  // ── Derived metrics ────────────────────────────────────────────
  const view = useMemo(() => {
    const bounds = periodBounds(state.period);
    const isMonthly = bounds.granularity === 'monthly';
    const totals = isMonthly
      ? totalsFromMonthlies(state.monthlies)
      : totalsFromDailies(state.dailies);
    const totalsPrev = isMonthly
      ? totalsFromMonthlies(state.monthliesPrev)
      : totalsFromDailies(state.dailiesPrev);

    // Build a continuous trend (no gaps) merging bookings + page
    // views by date/month key. Days/months with no data render as
    // 0 — gives a clean horizontal axis instead of collapsed gaps.
    const bookingTrend = isMonthly
      ? trendFromMonthlies(state.monthlies)
      : trendFromDailies(state.dailies);
    const trend = buildContinuousTrend(
      bounds.start,
      bounds.end,
      bounds.granularity,
      bookingTrend,
      state.pageViewsByKey,
    );

    // 7d → bar (each day reads as a discrete unit). 30d/90d/12m →
    // smoothed area (the trend matters more than per-day heights,
    // and the chart stays readable with 30+ points).
    const chartType: ChartType = state.period === '7d' ? 'bar' : 'line';

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

    // Per-category activity breakdown for the "Autres revenus"
    // panel. Computed from dailies (always loaded) regardless of
    // monthly granularity — same source of truth, deterministic.
    const activitiesByCategory = activityBreakdownFromDailies(
      isMonthly
        ? (state.monthlies as unknown as ProviderStatsDaily[])
        : state.dailies,
    );

    // True empty state — provider has literally no signal at all
    // on the platform yet. We show one friendly placeholder
    // instead of zero panels stacked on top of each other.
    const isCompletelyEmpty =
      totals.bookingsCount === 0 &&
      state.pageViewsCurrent === 0 &&
      (provider?.stats?.pageViews?.total ?? 0) === 0;

    return {
      totals,
      totalsPrev,
      trend,
      chartType,
      topServices,
      topClients,
      activitiesByCategory,
      cancellationRate,
      noshowRate,
      isCompletelyEmpty,
    };
  }, [state, provider]);

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
      ) : view.isCompletelyEmpty ? (
        <EmptyState />
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

          {/* Revenue trend — bar for 7d, smoothed area for 30d+ */}
          <TrendChart
            data={view.trend}
            title="Évolution du chiffre d'affaires"
            valueKey="revenue"
            chartType={view.chartType}
            yAxisFormatter={(v) =>
              v >= 100_000 ? `${Math.round(v / 100_000)} k€` : `${(v / 100).toFixed(0)} €`
            }
            tooltipFormatter={(v) => [formatPrice(v), 'CA']}
          />

          {/* Page-views trend — same bar/line logic */}
          <TrendChart
            data={view.trend}
            title="Évolution des vues de la vitrine"
            valueKey="pageViews"
            chartType={view.chartType}
            yAxisFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
            }
            tooltipFormatter={(v) => [v.toLocaleString('fr-FR'), 'Vues']}
          />

          {/* Top services + top clients side-by-side on lg+ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopServicesPanel data={view.topServices} />
            <TopClientsPanel data={view.topClients} />
          </div>

          {/* "Autres revenus" — paid activities. Renders nothing
              when there's no activity revenue on the period, so
              providers who don't use the feature never see it. */}
          <OtherRevenuePanel
            data={view.activitiesByCategory}
            total={view.totals.activityRevenue}
            count={view.totals.activityCount}
            periodLabel={PERIOD_LABELS[state.period]}
          />

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
// Empty state for brand-new providers
// ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/40 dark:from-primary-900/20 dark:to-primary-900/5 border border-primary-200/60 dark:border-primary-800/40 p-8 sm:p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white mb-4 shadow-lg shadow-primary-600/20">
        <Sparkles className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Vos statistiques arriveront ici
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
        Dès que vous recevrez vos premières réservations et que votre vitrine sera consultée,
        cette page se remplira automatiquement&nbsp;: chiffre d'affaires, clients,
        services les plus demandés et heatmap d'activité.
      </p>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
        Aucune action requise — l'agrégation tourne en temps réel sur chaque nouvelle réservation.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Inline helpers: read pageViewsDaily / pageViewsMonthly with the
// per-bucket breakdown. We return both `byKey` (for the trend
// chart's bucket-level rendering) and `total` (for the KPI sum)
// in one query.
// ────────────────────────────────────────────────────────────────

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

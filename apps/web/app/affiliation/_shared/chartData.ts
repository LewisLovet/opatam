/**
 * Chart data derivations.
 *
 * The temporal series (revenue, cumulative, signups) read from the
 * pre-aggregated `monthlyStats` subcollection maintained by the
 * `onAffiliateLogAggregate` and `onProviderReferralAggregate` Cloud
 * Function triggers. This means a single page load fetches ~13 docs
 * regardless of how many years of history the affiliate has.
 *
 * The "Top 5" list is also pre-aggregated (`topReferrals` subcollection).
 *
 * The donut still derives from the in-memory `referrals` list because
 * we need the *current* subscription status of each referral, not its
 * historical snapshot.
 */

import type {
  MonthlyStat,
  ReferralProvider,
  TopReferralAggregate,
} from './useAffiliate';

export interface MonthlyPoint {
  /** yyyy-MM — sortable */
  key: string;
  /** Short display label, e.g. "avr" */
  label: string;
  /** Primary value (cents for money charts, count otherwise) */
  value: number;
  /** Secondary value, e.g. invoice commission for the stacked revenue chart */
  value2?: number;
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map((s) => parseInt(s, 10));
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

/** Build an empty timeline of the last N months (oldest → newest). */
function buildEmptyTimeline(monthsBack: number): MonthlyPoint[] {
  const now = new Date();
  now.setDate(1);
  const out: MonthlyPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: monthLabelFromKey(key), value: 0 });
  }
  return out;
}

/**
 * Stacked monthly revenue (commission received) — value = checkout
 * (1st payment), value2 = invoice (recurring renewals).
 */
export function getMonthlyRevenue(
  monthlyStats: MonthlyStat[],
  monthsBack = 12,
): MonthlyPoint[] {
  const timeline = buildEmptyTimeline(monthsBack);
  const byKey = new Map(monthlyStats.map((s) => [s.monthKey, s]));
  for (const point of timeline) {
    const stat = byKey.get(point.key);
    if (!stat) continue;
    point.value = stat.checkoutCommission ?? 0;
    point.value2 = stat.invoiceCommission ?? 0;
  }
  return timeline;
}

/** Cumulative net commission month by month (running sum). */
export function getCumulativeCommission(
  monthlyStats: MonthlyStat[],
  monthsBack = 12,
): MonthlyPoint[] {
  const timeline = buildEmptyTimeline(monthsBack);
  const byKey = new Map(monthlyStats.map((s) => [s.monthKey, s]));

  // Seed the running sum with everything BEFORE the visible window — this way
  // the first visible month shows the true historical cumulative, not 0.
  const earliestVisibleKey = timeline[0]?.key ?? '';
  let running = 0;
  for (const stat of monthlyStats) {
    if (stat.monthKey < earliestVisibleKey) {
      running += (stat.commissionGross ?? 0) - (stat.commissionRefunds ?? 0);
    }
  }

  for (const point of timeline) {
    const stat = byKey.get(point.key);
    if (stat) {
      running += (stat.commissionGross ?? 0) - (stat.commissionRefunds ?? 0);
    }
    point.value = running;
  }
  return timeline;
}

/** New referrals (signups) per month. */
export function getMonthlySignups(
  monthlyStats: MonthlyStat[],
  monthsBack = 12,
): MonthlyPoint[] {
  const timeline = buildEmptyTimeline(monthsBack);
  const byKey = new Map(monthlyStats.map((s) => [s.monthKey, s]));
  for (const point of timeline) {
    const stat = byKey.get(point.key);
    if (stat) point.value = stat.newReferrals ?? 0;
  }
  return timeline;
}

export interface StatusSlice {
  label: string;
  value: number;
  color: string;
}

/** Current distribution of referrals by subscription status. */
export function getReferralStatusBreakdown(
  referrals: ReferralProvider[],
): StatusSlice[] {
  let trial = 0;
  let active = 0;
  let canceled = 0;
  let unknown = 0;

  for (const r of referrals) {
    const status = r.subscription?.status ?? null;
    if (status === 'trialing' || r.subscription?.plan === 'trial') {
      trial++;
    } else if (status === 'active') {
      active++;
    } else if (status === 'canceled' || status === 'past_due' || status === 'unpaid') {
      canceled++;
    } else {
      unknown++;
    }
  }

  return [
    { label: 'En essai', value: trial, color: '#f59e0b' },
    { label: 'Actifs', value: active, color: '#10b981' },
    { label: 'Perdus', value: canceled, color: '#ef4444' },
    { label: 'Autre', value: unknown, color: '#9ca3af' },
  ].filter((s) => s.value > 0);
}

export interface TopReferral {
  providerId: string;
  businessName: string;
  commission: number;
  paymentCount: number;
}

/** Top N referrals from the pre-aggregated topReferrals subcollection. */
export function getTopReferrals(
  topReferrals: TopReferralAggregate[],
  topN = 5,
): TopReferral[] {
  return topReferrals
    .slice()
    .sort((a, b) => b.totalCommission - a.totalCommission)
    .slice(0, topN)
    .map((t) => ({
      providerId: t.providerId,
      businessName: t.businessName ?? '—',
      commission: t.totalCommission,
      paymentCount: t.paymentCount,
    }));
}

export interface MonthComparison {
  thisMonth: number;
  lastMonth: number;
  deltaPercent: number | null; // null if lastMonth is 0
}

/** Current vs previous month comparison for a given metric. */
export function compareCurrentToPreviousMonth(
  monthlyStats: MonthlyStat[],
  metric: 'commission' | 'count',
): MonthComparison {
  const now = new Date();
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const byKey = new Map(monthlyStats.map((s) => [s.monthKey, s]));
  const t = byKey.get(thisKey);
  const p = byKey.get(prevKey);

  const pick = (s: MonthlyStat | undefined): number => {
    if (!s) return 0;
    if (metric === 'commission') return (s.commissionGross ?? 0) - (s.commissionRefunds ?? 0);
    return s.paymentCount ?? 0;
  };

  const thisMonth = pick(t);
  const lastMonth = pick(p);
  const deltaPercent = lastMonth === 0 ? null : ((thisMonth - lastMonth) / lastMonth) * 100;
  return { thisMonth, lastMonth, deltaPercent };
}

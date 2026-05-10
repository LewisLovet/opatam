/**
 * Client-side roll-up helpers — sum a set of daily / monthly docs
 * into the KPI numbers the dashboard displays. The Cloud Functions
 * pipeline produces the daily/monthly docs already aggregated; this
 * module only sums them across the selected period.
 */

import type {
  ProviderStatsActivityBreakdown,
  ProviderStatsDaily,
  ProviderStatsMonthly,
  ProviderStatsServiceBreakdown,
} from '@booking-app/shared';

export interface PeriodTotals {
  /** Sum of revenue (cents) — confirmed bookings only. */
  revenue: number;
  /** Total bookings across all statuses. */
  bookingsCount: number;
  confirmedCount: number;
  cancelledCount: number;
  noshowCount: number;
  /**
   * "Autres revenus" track — sum of paid-activity `amount` (cents)
   * over the period. Tracked separately so the UI can show CA RDV
   * and CA hors-RDV side by side without conflating the two.
   */
  activityRevenue: number;
  activityCount: number;
  /** Distinct client identities across the period (union of hashes). */
  uniqueClients: number;
  /** Bookings whose first-ever appearance for this provider falls in the period. */
  newClients: number;
}

export function totalsFromDailies(
  dailies: ProviderStatsDaily[],
): PeriodTotals {
  const clientHashes = new Set<string>();
  const newClientHashes = new Set<string>();
  let revenue = 0;
  let bookingsCount = 0;
  let confirmedCount = 0;
  let cancelledCount = 0;
  let noshowCount = 0;
  let activityRevenue = 0;
  let activityCount = 0;

  for (const d of dailies) {
    revenue += d.revenue;
    bookingsCount += d.bookingsCount;
    confirmedCount += d.confirmedCount;
    cancelledCount += d.cancelledCount;
    noshowCount += d.noshowCount;
    // `?? 0` guards legacy daily docs written before the
    // activityRevenue field was added — old docs read as 0 instead
    // of NaN, which keeps the KPI bar honest.
    activityRevenue += d.activityRevenue ?? 0;
    activityCount += d.activityCount ?? 0;
    for (const h of d.clientHashes) clientHashes.add(h);
    for (const h of d.newClientHashes) newClientHashes.add(h);
  }

  return {
    revenue,
    bookingsCount,
    confirmedCount,
    cancelledCount,
    noshowCount,
    activityRevenue,
    activityCount,
    uniqueClients: clientHashes.size,
    newClients: newClientHashes.size,
  };
}

export function totalsFromMonthlies(
  monthlies: ProviderStatsMonthly[],
): PeriodTotals {
  // Identical shape — share the implementation.
  return totalsFromDailies(monthlies as unknown as ProviderStatsDaily[]);
}

/**
 * Roll up the per-category activity breakdown across a set of
 * daily docs. Returned sorted by revenue desc so the UI can
 * render top contributors first.
 */
export function activityBreakdownFromDailies(
  dailies: ProviderStatsDaily[],
): ProviderStatsActivityBreakdown[] {
  const acc = new Map<string, ProviderStatsActivityBreakdown>();
  for (const d of dailies) {
    for (const c of d.activitiesByCategory ?? []) {
      let entry = acc.get(c.category);
      if (!entry) {
        entry = { category: c.category, count: 0, revenue: 0 };
        acc.set(c.category, entry);
      }
      entry.count += c.count;
      entry.revenue += c.revenue;
    }
  }
  return [...acc.values()].sort((a, b) => b.revenue - a.revenue);
}

/**
 * Reduce a set of dailies to the top services by revenue. Used for
 * the 7-day window where the rolling snapshot is too coarse (it
 * only carries 30d/90d/all-time).
 */
export function topServicesFromDailies(
  dailies: ProviderStatsDaily[],
  topK = 10,
): ProviderStatsServiceBreakdown[] {
  const acc = new Map<string, ProviderStatsServiceBreakdown>();
  for (const d of dailies) {
    for (const s of d.services) {
      let entry = acc.get(s.serviceId);
      if (!entry) {
        entry = {
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          bookingsCount: 0,
          confirmedCount: 0,
          revenue: 0,
        };
        acc.set(s.serviceId, entry);
      }
      entry.bookingsCount += s.bookingsCount;
      entry.confirmedCount += s.confirmedCount;
      entry.revenue += s.revenue;
    }
  }
  return [...acc.values()]
    .sort((a, b) => b.revenue - a.revenue || b.bookingsCount - a.bookingsCount)
    .slice(0, topK);
}

/**
 * Bucketise a set of dailies for the trend chart. For daily-period
 * bounds we keep one bar per day; for monthly period we sum into
 * one bar per month from the monthly docs directly (caller swaps
 * the input).
 */
export interface TrendPoint {
  /** Either YYYY-MM-DD or YYYY-MM depending on granularity. */
  key: string;
  /** Display label for the X axis (e.g. "12 mai" or "mai 26"). */
  label: string;
  revenue: number;
  bookingsCount: number;
  /**
   * Page views for this bucket. Filled by the page after merging
   * pageViewsDaily / pageViewsMonthly into the bookings trend by
   * matching `key` strings. Defaults to 0 when no view doc exists
   * for that bucket.
   */
  pageViews: number;
}

const MONTH_LABELS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

export function trendFromDailies(dailies: ProviderStatsDaily[]): TrendPoint[] {
  return dailies.map((d) => ({
    key: d.date,
    label: shortDateLabelFr(d.date),
    revenue: d.revenue,
    bookingsCount: d.bookingsCount,
    pageViews: 0,
  }));
}

export function trendFromMonthlies(monthlies: ProviderStatsMonthly[]): TrendPoint[] {
  return monthlies.map((m) => ({
    key: m.month,
    label: shortMonthLabelFr(m.month),
    revenue: m.revenue,
    bookingsCount: m.bookingsCount,
    pageViews: 0,
  }));
}

/**
 * Build a date-keyed series covering EVERY bucket between two
 * dates, even when the source has gaps. Used so the chart shows a
 * continuous timeline (a day with 0 bookings still appears as a
 * 0-bar / 0-point) rather than collapsing missing days.
 *
 * `granularity` selects the bucket size. `bookingTrend` is the
 * existing dailies/monthlies trend; `pageViewsByKey` is a map
 * built from pageViewsDaily / pageViewsMonthly. Output: one
 * TrendPoint per bucket, sorted ascending.
 */
export function buildContinuousTrend(
  startKey: string,
  endKey: string,
  granularity: 'daily' | 'monthly',
  bookingTrend: TrendPoint[],
  pageViewsByKey: Map<string, number>,
): TrendPoint[] {
  const bookingByKey = new Map(bookingTrend.map((p) => [p.key, p]));
  const keys =
    granularity === 'daily'
      ? generateDateKeys(startKey, endKey)
      : generateMonthKeys(startKey.slice(0, 7), endKey.slice(0, 7));
  return keys.map((key) => {
    const b = bookingByKey.get(key);
    return {
      key,
      label:
        granularity === 'daily'
          ? shortDateLabelFr(key)
          : shortMonthLabelFr(key),
      revenue: b?.revenue ?? 0,
      bookingsCount: b?.bookingsCount ?? 0,
      pageViews: pageViewsByKey.get(key) ?? 0,
    };
  });
}

function generateDateKeys(startYmd: string, endYmd: string): string[] {
  const keys: string[] = [];
  const cur = new Date(`${startYmd}T00:00:00Z`);
  const end = new Date(`${endYmd}T00:00:00Z`);
  while (cur <= end) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

function generateMonthKeys(startYm: string, endYm: string): string[] {
  const keys: string[] = [];
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function shortDateLabelFr(yyyymmdd: string): string {
  // "2026-05-12" → "12 mai"
  const [, mm, dd] = yyyymmdd.split('-');
  const monthIdx = parseInt(mm, 10) - 1;
  const day = parseInt(dd, 10);
  return `${day} ${MONTH_LABELS_FR[monthIdx]}`;
}

function shortMonthLabelFr(yyyymm: string): string {
  // "2026-05" → "mai 26"
  const [yyyy, mm] = yyyymm.split('-');
  const monthIdx = parseInt(mm, 10) - 1;
  return `${MONTH_LABELS_FR[monthIdx]} ${yyyy.slice(2)}`;
}

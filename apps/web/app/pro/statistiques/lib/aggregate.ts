/**
 * Client-side roll-up helpers — sum a set of daily / monthly docs
 * into the KPI numbers the dashboard displays. The Cloud Functions
 * pipeline produces the daily/monthly docs already aggregated; this
 * module only sums them across the selected period.
 */

import type {
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

  for (const d of dailies) {
    revenue += d.revenue;
    bookingsCount += d.bookingsCount;
    confirmedCount += d.confirmedCount;
    cancelledCount += d.cancelledCount;
    noshowCount += d.noshowCount;
    for (const h of d.clientHashes) clientHashes.add(h);
    for (const h of d.newClientHashes) newClientHashes.add(h);
  }

  return {
    revenue,
    bookingsCount,
    confirmedCount,
    cancelledCount,
    noshowCount,
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
}

const MONTH_LABELS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

export function trendFromDailies(dailies: ProviderStatsDaily[]): TrendPoint[] {
  return dailies.map((d) => ({
    key: d.date,
    label: shortDateLabelFr(d.date),
    revenue: d.revenue,
    bookingsCount: d.bookingsCount,
  }));
}

export function trendFromMonthlies(monthlies: ProviderStatsMonthly[]): TrendPoint[] {
  return monthlies.map((m) => ({
    key: m.month,
    label: shortMonthLabelFr(m.month),
    revenue: m.revenue,
    bookingsCount: m.bookingsCount,
  }));
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

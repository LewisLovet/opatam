/**
 * Period selection utilities for /pro/statistiques.
 *
 * Centralised so the period selector, the KPI bar and the chart
 * agree on the same date math without copy-paste drift.
 */

export type Period = '7d' | '30d' | '90d' | '12m';

export const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
  '12m': '12 mois',
};

/**
 * YYYY-MM-DD in the provider's local timezone (matches the agg
 * pipeline's `dateKeyInTz`). Default Europe/Paris.
 */
function dateKey(d: Date, tz = 'Europe/Paris'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** YYYY-MM in the provider's local timezone. */
function monthKey(d: Date, tz = 'Europe/Paris'): string {
  return dateKey(d, tz).slice(0, 7);
}

/**
 * Boundaries of the current period AND the previous period of
 * the same length (for delta calculations). All boundaries are
 * inclusive at both ends.
 */
export interface PeriodBounds {
  /** Start date YYYY-MM-DD inclusive. */
  start: string;
  /** End date YYYY-MM-DD inclusive (today for live periods). */
  end: string;
  /** Start of the previous period of the same length. */
  prevStart: string;
  /** End of the previous period (= start - 1 day). */
  prevEnd: string;
  /** Granularity for the trend chart. */
  granularity: 'daily' | 'monthly';
  /**
   * For monthly granularity, expose YYYY-MM bounds too. Daily
   * periods don't populate these.
   */
  startMonth?: string;
  endMonth?: string;
  prevStartMonth?: string;
  prevEndMonth?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function periodBounds(period: Period, now: Date = new Date()): PeriodBounds {
  if (period === '12m') {
    // Walk backward N months in calendar (not 30 * N days) so the
    // chart aligns to month boundaries.
    const endMonthDate = new Date(now);
    const startMonthDate = new Date(now);
    startMonthDate.setMonth(startMonthDate.getMonth() - 11); // 12 months inclusive
    const prevEndDate = new Date(startMonthDate);
    prevEndDate.setMonth(prevEndDate.getMonth() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 11);

    // For KPI sums on monthly we still want daily-ish boundaries
    // for accuracy. Use the first of `startMonth` and last of
    // `endMonth` as date keys.
    const startMonth = monthKey(startMonthDate);
    const endMonth = monthKey(endMonthDate);
    return {
      start: `${startMonth}-01`,
      end: dateKey(now),
      prevStart: `${monthKey(prevStartDate)}-01`,
      prevEnd: `${monthKey(prevEndDate)}-31`,
      granularity: 'monthly',
      startMonth,
      endMonth,
      prevStartMonth: monthKey(prevStartDate),
      prevEndMonth: monthKey(prevEndDate),
    };
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const endDate = now;
  const startDate = new Date(now.getTime() - (days - 1) * MS_PER_DAY);
  const prevEndDate = new Date(startDate.getTime() - MS_PER_DAY);
  const prevStartDate = new Date(prevEndDate.getTime() - (days - 1) * MS_PER_DAY);

  return {
    start: dateKey(startDate),
    end: dateKey(endDate),
    prevStart: dateKey(prevStartDate),
    prevEnd: dateKey(prevEndDate),
    granularity: 'daily',
  };
}

/**
 * Format a percent delta with sign. Returns null when the
 * baseline is 0 (no meaningful "% change" from zero).
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10; // 1 decimal
}

/**
 * useProviderStats Hook
 *
 * Reads from the pre-aggregated providerStatsMonthly collection
 * instead of scanning every booking on each open. The cost-per-call
 * goes from N reads (all the provider's bookings, potentially
 * thousands) to a bounded ~12 reads (one per month over the last
 * 12 months) — a ~1000× reduction at scale.
 *
 * Public shape kept identical to the previous implementation so
 * the existing /(pro)/stats screen renders without changes. The
 * "all-time" status counters are now approximated as a 12-month
 * trailing window — same scale of meaning for a salon dashboard
 * and bounded cost. If we ever need the literal all-time we can
 * surface it via a denormalised counter on the Provider doc.
 */

import { useState, useEffect, useCallback } from 'react';
import { providerStatsRepository } from '@booking-app/firebase';
import type { ProviderStatsMonthly } from '@booking-app/shared';

export interface ProviderStats {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  noshow: number;
  completionRate: number;
  monthlyRevenue: number;
  monthlyBookingsCount: number;
}

export interface UseProviderStatsResult {
  stats: ProviderStats | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** YYYY-MM in Europe/Paris — matches the agg pipeline's month keys. */
function monthKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
    .format(d)
    .slice(0, 7);
}

export function useProviderStats(providerId: string | null): UseProviderStatsResult {
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

      const now = new Date();
      const currentMonth = monthKey(now);

      // Trailing 12-month window — bounded cost.
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      const startMonth = monthKey(twelveMonthsAgo);

      const monthlies = await providerStatsRepository.getMonthliesInRange(
        providerId,
        startMonth,
        currentMonth,
      );

      setStats(toLegacyShape(monthlies, currentMonth));
    } catch (err) {
      console.error('[useProviderStats] error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, isLoading, error, refresh };
}

/**
 * Reduce a 12-month window of providerStatsMonthly docs to the
 * legacy ProviderStats shape. Status counters are summed across the
 * window; revenue + bookings count isolate the current calendar month
 * to match the existing UI's "Revenus — {currentMonth}" hero.
 */
function toLegacyShape(
  monthlies: ProviderStatsMonthly[],
  currentMonth: string,
): ProviderStats {
  let total = 0;
  let pending = 0;
  let confirmed = 0;
  let cancelled = 0;
  let noshow = 0;
  let monthlyRevenue = 0;
  let monthlyBookingsCount = 0;

  for (const m of monthlies) {
    total += m.bookingsCount ?? 0;
    pending += (m.pendingCount ?? 0) + (m.pendingPaymentCount ?? 0);
    confirmed += m.confirmedCount ?? 0;
    cancelled += m.cancelledCount ?? 0;
    noshow += m.noshowCount ?? 0;
    if (m.month === currentMonth) {
      monthlyRevenue = m.revenue ?? 0;
      monthlyBookingsCount = m.bookingsCount ?? 0;
    }
  }

  // Same definition as the previous implementation:
  // completion = 1 − (cancelled + noshow) / total.
  const totalNonCancelled = total - cancelled - noshow;
  const completionRate = total > 0
    ? Math.round((totalNonCancelled / total) * 100)
    : 0;

  return {
    total,
    pending,
    confirmed,
    cancelled,
    noshow,
    completionRate,
    monthlyRevenue,
    monthlyBookingsCount,
  };
}

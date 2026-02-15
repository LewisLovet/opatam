/**
 * useProviderStats Hook
 * Fetches booking statistics and revenue for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { bookingService } from '@booking-app/firebase';
import type { Booking } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

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

const getMonthRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

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

      const { start, end } = getMonthRange();

      const [baseStats, monthlyBookings] = await Promise.all([
        bookingService.getStatistics(providerId),
        bookingService.getProviderBookings(providerId, {
          startDate: start,
          endDate: end,
          status: ['confirmed', 'completed'] as any,
        }),
      ]);

      const completed = baseStats.confirmed; // Confirmed includes completed ones
      const totalNonCancelled = baseStats.total - baseStats.cancelled - baseStats.noshow;
      const completionRate = baseStats.total > 0
        ? Math.round((totalNonCancelled / baseStats.total) * 100)
        : 0;

      // Calculate revenue from monthly completed bookings
      const monthlyRevenue = monthlyBookings.reduce((sum, booking) => {
        return sum + (booking.price || 0);
      }, 0);

      setStats({
        ...baseStats,
        completionRate,
        monthlyRevenue,
        monthlyBookingsCount: monthlyBookings.length,
      });
    } catch (err) {
      console.error('Error fetching provider stats:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, isLoading, error, refresh };
}

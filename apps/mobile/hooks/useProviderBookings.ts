/**
 * useProviderBookings Hook
 * Fetches provider's bookings with flexible filters (status, member, date range)
 */

import { useState, useEffect, useCallback } from 'react';
import { bookingService, type BookingFilters } from '@booking-app/firebase';
import type { Booking, BookingStatus } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseProviderBookingsOptions {
  providerId: string | null;
  status?: BookingStatus | BookingStatus[];
  memberId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface UseProviderBookingsResult {
  bookings: WithId<Booking>[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProviderBookings(options: UseProviderBookingsOptions): UseProviderBookingsResult {
  const { providerId, status, memberId, startDate, endDate, limit } = options;
  const [bookings, setBookings] = useState<WithId<Booking>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!providerId) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const filters: BookingFilters = {};
      if (status) filters.status = status;
      if (memberId) filters.memberId = memberId;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (limit) filters.limit = limit;

      const result = await bookingService.getProviderBookings(providerId, filters);
      setBookings(result);
    } catch (err) {
      console.error('Error fetching provider bookings:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  // Serialize status to avoid referential equality issues with arrays
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, JSON.stringify(status), memberId, startDate?.getTime(), endDate?.getTime(), limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bookings, isLoading, error, refresh };
}

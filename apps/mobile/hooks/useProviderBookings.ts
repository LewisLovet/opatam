/**
 * useProviderBookings Hook
 *
 * Real-time subscription to a provider's bookings, with the same
 * filter semantics as `bookingService.getProviderBookings`. The
 * callback fires on every Firestore change (create / update /
 * delete), so consumers stay in sync without a manual refetch or
 * pull-to-refresh.
 *
 * `refresh` is kept on the result for backwards-compatibility with
 * existing call sites (pull-to-refresh handlers, post-mutation
 * `await refresh()`), but with a live listener attached it's a
 * no-op outside of the rare case where the listener has been
 * silently dropped — see implementation note inside.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Keep a fresh ref to the current filters so `refresh` can do an
  // on-demand re-fetch even after deps changed since mount.
  const filtersRef = useRef<BookingFilters>({});

  useEffect(() => {
    if (!providerId) {
      setBookings([]);
      setIsLoading(false);
      return;
    }

    const filters: BookingFilters = {};
    if (status) filters.status = status;
    if (memberId) filters.memberId = memberId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (limit) filters.limit = limit;
    filtersRef.current = filters;

    setIsLoading(true);
    setError(null);
    const unsubscribe = bookingService.subscribeToProviderBookings(
      providerId,
      filters,
      (next) => {
        setBookings(next);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error subscribing to provider bookings:', err);
        setError(err.message || 'Erreur de chargement');
        setIsLoading(false);
      },
    );
    return unsubscribe;
  // Serialize status to avoid referential equality issues with arrays
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, JSON.stringify(status), memberId, startDate?.getTime(), endDate?.getTime(), limit]);

  // Kept for backwards-compat — pulls a one-shot snapshot. The live
  // listener should keep data fresh, but if a caller insists on
  // refreshing (e.g. a pull-to-refresh gesture for user feedback),
  // we honour it.
  const refresh = useCallback(async () => {
    if (!providerId) return;
    try {
      const result = await bookingService.getProviderBookings(providerId, filtersRef.current);
      setBookings(result);
    } catch (err) {
      console.error('Error refreshing provider bookings:', err);
    }
  }, [providerId]);

  return { bookings, isLoading, error, refresh };
}

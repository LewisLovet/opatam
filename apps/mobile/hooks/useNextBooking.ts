/**
 * useNextBooking Hook
 * Get the next upcoming booking for the authenticated client
 */

import { useClientBookings } from './useClientBookings';
import type { Booking } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseNextBookingResult {
  nextBooking: WithId<Booking> | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useNextBooking(): UseNextBookingResult {
  const { upcoming, loading, error, refresh } = useClientBookings();

  // Get the first upcoming booking (already sorted by date ascending)
  const nextBooking = upcoming.length > 0 ? upcoming[0] : null;

  return {
    nextBooking,
    loading,
    error,
    refresh,
  };
}

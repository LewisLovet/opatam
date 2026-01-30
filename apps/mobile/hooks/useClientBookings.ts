/**
 * useClientBookings Hook
 * Fetch and manage client bookings with filtering for upcoming/past
 */

import { useState, useEffect, useCallback } from 'react';
import { bookingService, type WithId } from '@booking-app/firebase';
import type { Booking } from '@booking-app/shared';
import { useAuth } from '../contexts';

export interface UseClientBookingsResult {
  bookings: WithId<Booking>[];
  upcoming: WithId<Booking>[];
  past: WithId<Booking>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useClientBookings(): UseClientBookingsResult {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<WithId<Booking>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!user?.uid) {
      setBookings([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bookingService.getClientBookings(user.uid);
      setBookings(result);
    } catch (err: any) {
      console.error('Error loading bookings:', err);
      setError(err.message || 'Erreur lors du chargement des réservations');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const refresh = useCallback(async () => {
    await loadBookings();
  }, [loadBookings]);

  // Filter upcoming: datetime > now AND status in ['confirmed', 'pending']
  const upcoming = bookings.filter((booking) => {
    const bookingDate = booking.datetime instanceof Date
      ? booking.datetime
      : (booking.datetime as any).toDate?.() || new Date(booking.datetime);
    const now = new Date();
    return bookingDate > now && ['confirmed', 'pending'].includes(booking.status);
  }).sort((a, b) => {
    // Sort by datetime ascending (soonest first)
    const dateA = a.datetime instanceof Date ? a.datetime : (a.datetime as any).toDate?.() || new Date(a.datetime);
    const dateB = b.datetime instanceof Date ? b.datetime : (b.datetime as any).toDate?.() || new Date(b.datetime);
    return dateA.getTime() - dateB.getTime();
  });

  // Filter past: datetime <= now OR status in ['cancelled', 'noshow']
  const past = bookings.filter((booking) => {
    const bookingDate = booking.datetime instanceof Date
      ? booking.datetime
      : (booking.datetime as any).toDate?.() || new Date(booking.datetime);
    const now = new Date();
    return bookingDate <= now || ['cancelled', 'noshow'].includes(booking.status);
  }).sort((a, b) => {
    // Sort by datetime descending (most recent first)
    const dateA = a.datetime instanceof Date ? a.datetime : (a.datetime as any).toDate?.() || new Date(a.datetime);
    const dateB = b.datetime instanceof Date ? b.datetime : (b.datetime as any).toDate?.() || new Date(b.datetime);
    return dateB.getTime() - dateA.getTime();
  });

  return {
    bookings,
    upcoming,
    past,
    loading,
    error,
    refresh,
  };
}

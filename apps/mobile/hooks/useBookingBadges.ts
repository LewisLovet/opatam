/**
 * useBookingBadges Hook
 * Real-time badge counts for tab navigation using Firestore onSnapshot.
 *
 * For Pro:
 *   - todayCount: number of bookings today (confirmed + pending)
 *   - pendingCount: number of bookings awaiting confirmation
 *
 * For Client:
 *   - upcomingCount: number of upcoming bookings
 */

import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@booking-app/firebase/firestore';

interface ProBadges {
  todayCount: number;
  pendingCount: number;
}

interface ClientBadges {
  upcomingCount: number;
}

/**
 * Real-time badge counts for pro tabs
 */
export function useProBookingBadges(providerId: string | null | undefined): ProBadges {
  const [todayCount, setTodayCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!providerId) return;

    // All bookings for this provider with status confirmed or pending
    // Filter today's bookings client-side to avoid complex composite index
    const todayQuery = query(
      collection(db, 'bookings'),
      where('providerId', '==', providerId),
      where('status', 'in', ['confirmed', 'pending'])
    );

    const unsubToday = onSnapshot(todayQuery, (snapshot) => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const count = snapshot.docs.filter((doc) => {
        const datetime = doc.data().datetime?.toDate?.();
        return datetime && datetime >= startOfDay && datetime <= endOfDay;
      }).length;
      setTodayCount(count);
    }, (err) => {
      console.warn('[useProBookingBadges] today listener error:', err);
    });

    // Pending bookings (awaiting confirmation)
    const pendingQuery = query(
      collection(db, 'bookings'),
      where('providerId', '==', providerId),
      where('status', '==', 'pending')
    );

    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      setPendingCount(snapshot.size);
    }, (err) => {
      console.warn('[useProBookingBadges] pending listener error:', err);
    });

    return () => {
      unsubToday();
      unsubPending();
    };
  }, [providerId]);

  // Update app icon badge with total (today + pending)
  useEffect(() => {
    const total = todayCount + pendingCount;
    Notifications.setBadgeCountAsync(total).catch(() => {});
  }, [todayCount, pendingCount]);

  return { todayCount, pendingCount };
}

/**
 * Real-time badge counts for client tabs
 */
export function useClientBookingBadges(clientId: string | null | undefined): ClientBadges {
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    if (!clientId) return;

    // Query all non-cancelled bookings for this client
    // Filter by datetime client-side so the count stays accurate as time passes
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('clientId', '==', clientId),
      where('status', 'in', ['confirmed', 'pending'])
    );

    const unsub = onSnapshot(bookingsQuery, (snapshot) => {
      const now = new Date();
      const count = snapshot.docs.filter((doc) => {
        const datetime = doc.data().datetime?.toDate?.();
        return datetime && datetime >= now;
      }).length;
      setUpcomingCount(count);
    }, (err) => {
      console.warn('[useClientBookingBadges] listener error:', err);
    });

    return () => unsub();
  }, [clientId]);

  // Update app icon badge
  useEffect(() => {
    Notifications.setBadgeCountAsync(upcomingCount).catch(() => {});
  }, [upcomingCount]);

  return { upcomingCount };
}

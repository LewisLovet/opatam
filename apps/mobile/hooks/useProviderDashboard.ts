/**
 * useProviderDashboard Hook
 * Loads all dashboard data in parallel: today's bookings, pending, week stats, members
 */

import { useState, useEffect, useCallback } from 'react';
import {
  bookingService,
  memberService,
  locationService,
  catalogService,
} from '@booking-app/firebase';
import type { Booking, Member, Location, Service } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface DashboardData {
  todayBookings: WithId<Booking>[];
  pendingBookings: WithId<Booking>[];
  weekBookingsCount: number;
  /** Bookings per day of week [Mon, Tue, Wed, Thu, Fri, Sat, Sun] */
  weekBookingsPerDay: number[];
  members: WithId<Member>[];
  locations: WithId<Location>[];
  services: WithId<Service>[];
  averageRating: number | null;
}

export interface UseProviderDashboardResult {
  data: DashboardData;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const emptyData: DashboardData = {
  todayBookings: [],
  pendingBookings: [],
  weekBookingsCount: 0,
  weekBookingsPerDay: [0, 0, 0, 0, 0, 0, 0],
  members: [],
  locations: [],
  services: [],
  averageRating: null,
};

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function useProviderDashboard(
  providerId: string | null,
  averageRating?: number | null
): UseProviderDashboardResult {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!providerId) {
      setData(emptyData);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { start: weekStart, end: weekEnd } = getWeekRange();

      const [todayBookings, pendingBookings, weekBookings, members, locations, services] =
        await Promise.all([
          bookingService.getTodayBookings(providerId),
          bookingService.getPendingBookings(providerId),
          bookingService.getProviderBookings(providerId, {
            startDate: weekStart,
            endDate: weekEnd,
            status: ['pending', 'confirmed'],
          }),
          memberService.getByProvider(providerId).catch(() => []),
          locationService.getByProvider(providerId).catch(() => []),
          catalogService.getByProvider(providerId).catch(() => []),
        ]);

      // Count bookings per day of week [Mon=0 .. Sun=6]
      const perDay = [0, 0, 0, 0, 0, 0, 0];
      for (const b of weekBookings) {
        const dt = b.datetime instanceof Date ? b.datetime : (b.datetime as any)?.toDate?.() || new Date(b.datetime);
        const jsDay = dt.getDay(); // 0=Sun, 1=Mon...6=Sat
        const idx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0...Sun=6
        perDay[idx]++;
      }

      setData({
        todayBookings,
        pendingBookings,
        weekBookingsCount: weekBookings.length,
        weekBookingsPerDay: perDay,
        members: (members as WithId<Member>[]).filter((m) => m.isActive),
        locations: locations as WithId<Location>[],
        services: services as WithId<Service>[],
        averageRating: averageRating ?? null,
      });
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [providerId, averageRating]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}

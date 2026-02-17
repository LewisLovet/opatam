/**
 * useOpeningHours Hook
 * Fetches weekly opening hours for a provider and transforms them into a displayable format
 */

import { useState, useEffect, useCallback } from 'react';
import { availabilityRepository, memberService } from '@booking-app/firebase';
import type { WithId } from '@booking-app/firebase';
import type { Availability, Member } from '@booking-app/shared';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export interface DaySchedule {
  day: string;
  isOpen: boolean;
  slots: { start: string; end: string }[];
}

export interface UseOpeningHoursResult {
  weekSchedule: DaySchedule[];
  isCurrentlyOpen: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_WEEK: DaySchedule[] = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
  day: DAY_NAMES[dayOfWeek],
  isOpen: false,
  slots: [],
}));

/**
 * Determine if the provider is currently open based on the week schedule
 */
function computeIsCurrentlyOpen(weekSchedule: DaySchedule[]): boolean {
  const now = new Date();
  const jsDay = now.getDay(); // 0=Sun
  const currentDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to Mon-first index
  const today = weekSchedule[currentDayIndex];

  if (!today?.isOpen || !today.slots.length) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return today.slots.some((slot) => {
    const [sh, sm] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);
    return currentMinutes >= sh * 60 + sm && currentMinutes < eh * 60 + em;
  });
}

export function useOpeningHours(providerId: string | undefined): UseOpeningHoursResult {
  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>(EMPTY_WEEK);
  const [loading, setLoading] = useState(true);

  const fetchOpeningHours = useCallback(async () => {
    if (!providerId) {
      setWeekSchedule(EMPTY_WEEK);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [availabilities, members] = await Promise.all([
        availabilityRepository.getByProvider(providerId),
        memberService.getActiveByProvider(providerId),
      ]);

      if (!members.length) {
        setWeekSchedule(EMPTY_WEEK);
        setLoading(false);
        return;
      }

      // Find the default member
      const defaultMember = members.find((m) => m.name === 'Principal') || members[0];

      // Filter for default member and exclude future scheduled changes
      const now = new Date();
      const schedule = availabilities.filter(
        (a) =>
          a.memberId === defaultMember.id &&
          (!a.effectiveFrom || a.effectiveFrom <= now)
      );

      // Build full week Monday-Sunday: [1,2,3,4,5,6,0]
      const result: DaySchedule[] = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
        const daySchedule = schedule.find((s) => s.dayOfWeek === dayOfWeek);
        return {
          day: DAY_NAMES[dayOfWeek],
          isOpen: daySchedule?.isOpen ?? false,
          slots: daySchedule?.slots ?? [],
        };
      });

      setWeekSchedule(result);
    } catch (err) {
      console.error('Error fetching opening hours:', err);
      setWeekSchedule(EMPTY_WEEK);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchOpeningHours();
  }, [fetchOpeningHours]);

  const isCurrentlyOpen = computeIsCurrentlyOpen(weekSchedule);

  return {
    weekSchedule,
    isCurrentlyOpen,
    loading,
    refresh: fetchOpeningHours,
  };
}

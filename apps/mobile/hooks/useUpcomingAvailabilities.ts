/**
 * useUpcomingAvailabilities Hook
 *
 * Builds a calendar-grid view of the pro's free slots over the next N
 * days. Powers the visual "Dispos" mode in the StoryShare modal — the
 * UI renders a 7-column × hour-row heatmap where free cells are
 * highlighted and busy/closed cells are greyed out.
 *
 * The hook reuses `schedulingService.getAvailableSlots` so what's
 * shown matches what a client would see when booking — same blocked
 * slots, same pending bookings, same min-notice rules.
 *
 * It picks a representative (service, member) pair — the shortest
 * active service + the default member — to anchor the computation. If
 * the provider has no services or no member yet, the schedule is
 * empty and the caller can hide the section.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  schedulingService,
  serviceRepository,
  memberRepository,
} from '@booking-app/firebase';

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export interface UpcomingDay {
  /** YYYY-MM-DD — stable React key */
  dateKey: string;
  /** "Lun" — short, fits a calendar header */
  weekday: string;
  /** 1-31, day of month for the column subheader */
  dayOfMonth: number;
  /** Set of half-hour bucket indices (hour*2 + halfHour) that have at
   *  least one free slot starting within them. E.g. a free slot at
   *  10:15 falls into bucket 20 (10:00-10:30). */
  freeHalfHours: Set<number>;
  /** True if the day has at least one free slot */
  isAvailable: boolean;
}

export interface UpcomingScheduleGrid {
  days: UpcomingDay[];
  /** Earliest hour with at least one free slot across all days, clamped
   *  to a sensible 8h floor so the grid doesn't start in the night */
  minHour: number;
  /** Latest hour with at least one free slot, clamped to a 20h ceiling */
  maxHour: number;
  /** True if every day in `days` is closed/full — caller should hide */
  isEmpty: boolean;
}

interface UseUpcomingAvailabilitiesParams {
  providerId: string | undefined;
  days?: number;
  /** Week offset from today. 0 = next 7 days from today, 1 = days
   *  7-13, 2 = days 14-20, etc. Lets the share modal step forward
   *  through future weeks. Negative values are clamped to 0 since
   *  past dispos can't be booked. Ignored when `dayOffset` is set. */
  weekOffset?: number;
  /** Day offset from today. 0 = today, 1 = tomorrow, ...
   *  Takes precedence over `weekOffset` — used by the day-scope
   *  story to point at a specific date. Negative values clamped
   *  to 0 (no past dispos). */
  dayOffset?: number;
  /** When false, the hook is idle (no fetch). Used to gate the heavy
   *  scheduling query to when the user actually opens the "Dispos" mode. */
  enabled?: boolean;
}

interface UseUpcomingAvailabilitiesResult {
  grid: UpcomingScheduleGrid;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_GRID: UpcomingScheduleGrid = {
  days: [],
  minHour: 9,
  maxHour: 19,
  isEmpty: true,
};

/**
 * Format a Date as YYYY-MM-DD using *local* components.
 *
 * Important: NOT `.toISOString().split('T')[0]` — that returns the
 * UTC date, which is the day BEFORE the local date for any user
 * east of UTC after about 22:00 / 23:00 local time, AND for users
 * in DST-shifted Europe whenever local midnight lands at 22:00 UTC
 * the previous day. The day-scope story passed yesterday's dateKey
 * to the title in those cases.
 */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useUpcomingAvailabilities(
  params: UseUpcomingAvailabilitiesParams,
): UseUpcomingAvailabilitiesResult {
  const { providerId, days = 7, weekOffset = 0, dayOffset, enabled = true } = params;
  // dayOffset wins when provided — gives the day-scope story
  // direct day-level navigation without the week granularity. When
  // both are set, dayOffset is the authoritative one.
  const offsetDays =
    dayOffset !== undefined
      ? Math.max(0, dayOffset)
      : Math.max(0, weekOffset) * 7;

  const [grid, setGrid] = useState<UpcomingScheduleGrid>(EMPTY_GRID);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!providerId || !enabled) {
      setGrid(EMPTY_GRID);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Anchor on the shortest active service: more slots fit, so the
      // viewer sees the most generous availability picture.
      const services = await serviceRepository.getActiveByProvider(providerId);
      if (services.length === 0) {
        setGrid(EMPTY_GRID);
        return;
      }
      const anchorService = services.reduce(
        (acc, s) => (s.duration < acc.duration ? s : acc),
        services[0],
      );

      const members = await memberRepository.getByProvider(providerId);
      if (members.length === 0) {
        setGrid(EMPTY_GRID);
        return;
      }
      const anchorMember = members.find((m) => m.isDefault) || members[0];

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() + offsetDays);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days - 1);
      endDate.setHours(23, 59, 59, 999);

      const slots = await schedulingService.getAvailableSlots({
        providerId,
        serviceId: anchorService.id,
        memberId: anchorMember.id,
        startDate,
        endDate,
      });

      // Bucket slots by day → set of free half-hour bucket indices.
      // Bucket index = hour*2 + (mins >= 30 ? 1 : 0) so 10:00 → 20,
      // 10:15 → 20, 10:30 → 21, 10:45 → 21.
      const byDay = new Map<string, Set<number>>();
      for (const s of slots) {
        const k = dateKey(s.date);
        if (!byDay.has(k)) byDay.set(k, new Set());
        const [hStr, mStr] = s.start.split(':');
        const hour = parseInt(hStr, 10);
        const min = parseInt(mStr, 10);
        const bucket = hour * 2 + (min >= 30 ? 1 : 0);
        byDay.get(k)!.add(bucket);
      }

      // Build one row per day in the requested range — empty days
      // (closed / fully booked) still appear in the grid as visual
      // "no availability" columns, which is informative.
      const cursor = new Date(startDate);
      const out: UpcomingDay[] = [];
      let minHour = 23;
      let maxHour = 0;
      for (let i = 0; i < days; i++) {
        const k = dateKey(cursor);
        const freeHalfHours = byDay.get(k) ?? new Set<number>();
        if (freeHalfHours.size > 0) {
          for (const b of freeHalfHours) {
            const h = Math.floor(b / 2);
            if (h < minHour) minHour = h;
            if (h > maxHour) maxHour = h;
          }
        }
        out.push({
          dateKey: k,
          weekday: DAYS_FR[cursor.getDay()],
          dayOfMonth: cursor.getDate(),
          freeHalfHours,
          isAvailable: freeHalfHours.size > 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      const allEmpty = out.every((d) => !d.isAvailable);
      // Clamp to a friendly business-hours window so the grid doesn't
      // start at 6am or end at 11pm if the data has a single outlier.
      // maxHour is INCLUSIVE — it's the last hour label shown.
      const clampedMin = allEmpty ? 9 : Math.max(8, Math.min(minHour, 12));
      const clampedMax = allEmpty ? 19 : Math.min(21, Math.max(maxHour, 18));

      setGrid({
        days: out,
        minHour: clampedMin,
        maxHour: clampedMax,
        isEmpty: allEmpty,
      });
    } catch (err) {
      console.error('[useUpcomingAvailabilities] error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Erreur lors du chargement des disponibilités',
      );
      setGrid(EMPTY_GRID);
    } finally {
      setLoading(false);
    }
  }, [providerId, days, offsetDays, enabled]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    grid,
    loading,
    error,
    refresh: fetchSchedule,
  };
}

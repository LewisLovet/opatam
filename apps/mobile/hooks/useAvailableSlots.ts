/**
 * useAvailableSlots Hook
 * Fetches available time slots for a given provider/service/member/date range
 */

import { useState, useEffect, useCallback } from 'react';
import { schedulingService } from '@booking-app/firebase';

// Time slot from scheduling service
export interface TimeSlot {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
}

// Grouped slots by date for easier display
export interface DaySlots {
  date: Date;
  dateKey: string; // YYYY-MM-DD format for comparison
  slots: TimeSlot[];
}

export interface UseAvailableSlotsParams {
  providerId: string | undefined;
  serviceId: string | undefined;
  memberId: string | undefined;
  startDate: Date;
  endDate: Date;
}

export interface UseAvailableSlotsResult {
  slots: TimeSlot[];
  slotsByDay: DaySlots[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Format date as YYYY-MM-DD
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Deduplicate slots by unique key (date + start time)
function deduplicateSlots(slots: TimeSlot[]): TimeSlot[] {
  const seen = new Set<string>();
  const result: TimeSlot[] = [];

  for (const slot of slots) {
    // Create unique key: date (YYYY-MM-DD) + start time
    const dateKey = slot.date.toISOString().split('T')[0];
    const uniqueKey = `${dateKey}-${slot.start}`;

    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      result.push(slot);
    }
  }

  return result;
}

// Group slots by date
function groupSlotsByDay(slots: TimeSlot[]): DaySlots[] {
  const grouped: Map<string, TimeSlot[]> = new Map();

  for (const slot of slots) {
    const dateKey = formatDateKey(slot.date);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(slot);
  }

  // Convert to array and sort by date
  const result: DaySlots[] = [];
  for (const [dateKey, daySlots] of grouped.entries()) {
    result.push({
      date: daySlots[0].date,
      dateKey,
      slots: daySlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime()),
    });
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function useAvailableSlots(params: UseAvailableSlotsParams): UseAvailableSlotsResult {
  const { providerId, serviceId, memberId, startDate, endDate } = params;

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!providerId || !serviceId || !memberId) {
      setSlots([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await schedulingService.getAvailableSlots({
        providerId,
        serviceId,
        memberId,
        startDate,
        endDate,
      });
      // Deduplicate slots to avoid duplicate keys in UI
      const uniqueSlots = deduplicateSlots(data);
      setSlots(uniqueSlots);
    } catch (err: any) {
      console.error('Error fetching available slots:', err);
      setError(err.message || 'Erreur lors du chargement des disponibilités');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [providerId, serviceId, memberId, startDate.getTime(), endDate.getTime()]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const refresh = useCallback(async () => {
    await fetchSlots();
  }, [fetchSlots]);

  const slotsByDay = groupSlotsByDay(slots);

  return { slots, slotsByDay, loading, error, refresh };
}

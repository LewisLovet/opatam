/**
 * useAvailabilitySummary Hook
 *
 * Per-day availability for the booking calendar over a range, in ONE batched
 * call to the shared `schedulingService.getAvailabilitySummary` (3 grouped
 * Firestore reads instead of 1 fetch per tapped day). Returns each day's
 * status + realistic capacity + the selectable slots, so the calendar shows
 * day states before any tap and opens a day instantly.
 */

import { useState, useEffect, useCallback } from 'react';
import { schedulingService } from '@booking-app/firebase';
import type { TimeSlot } from './useAvailableSlots';
import i18n from '../lib/i18n';

export type DayStatus = 'available' | 'almost_full' | 'full' | 'closed';

export interface DayInfo {
  status: DayStatus;
  capacity: number;
  slots: TimeSlot[];
}

export interface UseAvailabilitySummaryParams {
  providerId: string | undefined;
  serviceId: string | undefined;
  memberId: string | undefined;
  startDate: Date;
  endDate: Date;
  /** Full effective visit length (variations + last service buffer). */
  durationOverride?: number;
}

export interface UseAvailabilitySummaryResult {
  /** Keyed by local YYYY-MM-DD. */
  summary: Record<string, DayInfo>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAvailabilitySummary(
  params: UseAvailabilitySummaryParams,
): UseAvailabilitySummaryResult {
  const { providerId, serviceId, memberId, startDate, endDate, durationOverride } = params;

  const [summary, setSummary] = useState<Record<string, DayInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!providerId || !serviceId || !memberId) {
      setSummary({});
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const days = await schedulingService.getAvailabilitySummary({
        providerId,
        serviceId,
        memberId,
        startDate,
        endDate,
        durationOverride,
      });
      const map: Record<string, DayInfo> = {};
      for (const d of days) {
        map[d.date] = { status: d.status, capacity: d.capacity, slots: d.slots };
      }
      setSummary(map);
    } catch (err: any) {
      console.error('Error fetching availability summary:', err);
      setError(err.message || i18n.t('errors.availability.loadFailed'));
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [providerId, serviceId, memberId, startDate.getTime(), endDate.getTime(), durationOverride]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const refresh = useCallback(async () => {
    await fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refresh };
}

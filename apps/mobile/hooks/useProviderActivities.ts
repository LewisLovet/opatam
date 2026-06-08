/**
 * useProviderActivities
 *
 * Pulls a provider's "activités" — blocked slots that have a
 * category set, i.e. the personal-life entries (sport, meeting,
 * perso, admin, voyage, imprévu, autre). Plain blocks without a
 * category are left out: those are vacation-style blackouts and
 * already have their own management screen.
 *
 * Why filter on category client-side rather than via a Firestore
 * query: the existing `getBlockedSlotsInRange` query has no index
 * on `category` and adding one would force every blocked-slot
 * write through the new index. Activities are at most a few dozen
 * per provider per month, so the in-memory filter is cheap.
 *
 * Date range:
 *   - Both bounds set → exact slice (Planning screen, period filter)
 *   - Only `startDate` → everything from that point forward (the
 *     "À venir" tab uses this with start = now)
 *   - Only `endDate` → everything up to that point (the "Passé"
 *     tab uses this with end = now)
 *   - Neither → no fetch happens (nothing to filter against)
 *
 * The repository helper takes both bounds, so when one side is
 * open we pass a sentinel far date (epoch / +50 years).
 */

import { useState, useEffect, useCallback } from 'react';
import { schedulingService } from '@booking-app/firebase';
import type { BlockedSlot } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseProviderActivitiesOptions {
  providerId: string | null | undefined;
  /** Filter activities starting at or after this date. */
  startDate?: Date;
  /** Filter activities ending at or before this date. */
  endDate?: Date;
  /** Optional member filter (matches BlockedSlot.memberId). */
  memberId?: string;
}

export interface UseProviderActivitiesResult {
  activities: WithId<BlockedSlot>[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Sentinel far-past / far-future bounds used when one side is open. */
const FAR_PAST = new Date(0); // 1970-01-01
const FAR_FUTURE = new Date('2100-01-01T00:00:00Z');

export function useProviderActivities(
  options: UseProviderActivitiesOptions,
): UseProviderActivitiesResult {
  const { providerId, startDate, endDate, memberId } = options;
  const [activities, setActivities] = useState<WithId<BlockedSlot>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!providerId) {
      setActivities([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const rangeStart = startDate ?? FAR_PAST;
      const rangeEnd = endDate ?? FAR_FUTURE;
      const slots = await schedulingService.getBlockedSlotsInRange(
        providerId,
        rangeStart,
        rangeEnd,
      );
      // Two filters in one pass:
      //   - keep only categorised entries (= activités)
      //   - apply optional member filter
      const filtered = slots.filter((s) => {
        if (!s.category) return false;
        if (memberId && s.memberId !== memberId) return false;
        return true;
      });
      setActivities(filtered);
    } catch (err) {
      console.error('[useProviderActivities] error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
    // Date instances change every render even when the underlying
    // ms is identical — serialise to numbers in the dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, startDate?.getTime(), endDate?.getTime(), memberId]);

  // Live subscription — any add / edit / delete of an activity
  // (from /create-activity, /block-slot, or another device) reflects
  // here immediately, no manual refresh needed. Mirrors
  // useProviderBookings. The `refresh` callback above is kept for the
  // pull-to-refresh gesture (user feedback) and backwards-compat.
  useEffect(() => {
    if (!providerId) {
      setActivities([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const rangeStart = startDate ?? FAR_PAST;
    const rangeEnd = endDate ?? FAR_FUTURE;
    const unsubscribe = schedulingService.subscribeToBlockedSlotsInRange(
      providerId,
      rangeStart,
      rangeEnd,
      (slots) => {
        // Keep only categorised entries (= activités) + optional member filter.
        const filtered = slots.filter((s) => {
          if (!s.category) return false;
          if (memberId && s.memberId !== memberId) return false;
          return true;
        });
        setActivities(filtered);
        setIsLoading(false);
      },
      (err) => {
        console.error('[useProviderActivities] subscribe error:', err);
        setError(err.message || 'Erreur de chargement');
        setActivities([]);
        setIsLoading(false);
      },
    );
    return unsubscribe;
  // Date instances change every render even when the underlying ms is
  // identical — serialise to numbers in the dep array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, startDate?.getTime(), endDate?.getTime(), memberId]);

  return { activities, isLoading, error, refresh };
}

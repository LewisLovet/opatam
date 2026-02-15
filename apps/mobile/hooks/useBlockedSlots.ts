/**
 * useBlockedSlots Hook
 * Fetches upcoming blocked slots for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { schedulingService } from '@booking-app/firebase';
import type { BlockedSlot } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseBlockedSlotsResult {
  blockedSlots: WithId<BlockedSlot>[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBlockedSlots(providerId: string | null): UseBlockedSlotsResult {
  const [blockedSlots, setBlockedSlots] = useState<WithId<BlockedSlot>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!providerId) {
      setBlockedSlots([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await schedulingService.getUpcomingBlockedSlots(providerId);
      setBlockedSlots(result);
    } catch (err) {
      console.error('Error fetching blocked slots:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { blockedSlots, isLoading, error, refresh };
}

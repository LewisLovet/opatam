/**
 * useMembers Hook
 * Fetches active team members for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { memberService } from '@booking-app/firebase';
import type { Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseMembersResult {
  members: WithId<Member>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMembers(providerId: string | undefined): UseMembersResult {
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!providerId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await memberService.getActiveByProvider(providerId);
      // Sort by sortOrder
      const sorted = data.sort((a, b) => a.sortOrder - b.sortOrder);
      setMembers(sorted);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError(err.message || 'Erreur lors du chargement des membres');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const refresh = useCallback(async () => {
    await fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refresh };
}

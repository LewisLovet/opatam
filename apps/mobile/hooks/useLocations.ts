/**
 * useLocations Hook
 * Fetch locations for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { locationService } from '@booking-app/firebase';
import type { Location } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseLocationsResult {
  locations: WithId<Location>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLocations(providerId: string | undefined): UseLocationsResult {
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    if (!providerId) {
      setLocations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await locationService.getActiveByProvider(providerId);
      setLocations(result);
    } catch (err) {
      console.error('Error loading locations:', err);
      setError('Erreur lors du chargement des lieux');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  return {
    locations,
    loading,
    error,
    refresh: loadLocations,
  };
}

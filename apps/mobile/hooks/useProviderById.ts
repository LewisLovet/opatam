/**
 * useProviderById Hook
 * Fetch a single provider by ID (not slug)
 */

import { useState, useEffect, useCallback } from 'react';
import { providerService } from '@booking-app/firebase';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseProviderByIdResult {
  provider: WithId<Provider> | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProviderById(providerId: string | undefined): UseProviderByIdResult {
  const [provider, setProvider] = useState<WithId<Provider> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProvider = useCallback(async () => {
    if (!providerId) {
      setProvider(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await providerService.getById(providerId);

      if (!result) {
        setError('Prestataire non trouvé');
        setProvider(null);
      } else {
        setProvider(result);
      }
    } catch (err) {
      console.error('Error loading provider by ID:', err);
      setError('Erreur lors du chargement du prestataire');
      setProvider(null);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  const refresh = useCallback(async () => {
    await loadProvider();
  }, [loadProvider]);

  return {
    provider,
    loading,
    error,
    refresh,
  };
}

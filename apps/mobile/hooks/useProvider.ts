/**
 * useProvider Hook
 * Fetch a single provider by slug, using cache for instant display
 */

import { useState, useEffect, useCallback } from 'react';
import { providerService } from '@booking-app/firebase';
import { useProvidersCache } from '../contexts';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseProviderResult {
  provider: WithId<Provider> | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProvider(slug: string | undefined): UseProviderResult {
  const { getCachedProvider, addToCache } = useProvidersCache();

  // Check cache first for instant display
  const cachedProvider = slug ? getCachedProvider(slug) : null;

  const [provider, setProvider] = useState<WithId<Provider> | null>(cachedProvider);
  const [loading, setLoading] = useState(!cachedProvider);
  const [error, setError] = useState<string | null>(null);

  const loadProvider = useCallback(
    async (forceRefresh = false) => {
      if (!slug) {
        setProvider(null);
        setLoading(false);
        return;
      }

      // If we have cached data and not forcing refresh, use it immediately
      const cached = getCachedProvider(slug);
      if (cached && !forceRefresh) {
        setProvider(cached);
        setLoading(false);
        return;
      }

      // Show loading only if no cached data
      if (!cached) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await providerService.getBySlug(slug);

        if (!result) {
          setError('Prestataire non trouvé');
          setProvider(null);
        } else {
          setProvider(result);
          // Add to cache for future use
          addToCache(result);
        }
      } catch (err) {
        console.error('Error loading provider:', err);
        setError('Erreur lors du chargement du prestataire');
        // Keep cached data if available on error
        if (!cached) {
          setProvider(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [slug, getCachedProvider, addToCache]
  );

  useEffect(() => {
    // If we have cached data, show it immediately
    if (cachedProvider) {
      setProvider(cachedProvider);
      setLoading(false);
    } else {
      loadProvider(false);
    }
  }, [slug]); // Only depend on slug change

  const refresh = useCallback(async () => {
    await loadProvider(true);
  }, [loadProvider]);

  return {
    provider,
    loading,
    error,
    refresh,
  };
}

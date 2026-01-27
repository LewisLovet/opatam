/**
 * useProviders Hook
 * Fetch and search providers using the cache context
 */

import { useState, useEffect, useCallback } from 'react';
import { useProvidersCache } from '../contexts';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseProvidersOptions {
  category?: string | null;
  city?: string | null;
  query?: string | null;
  limit?: number;
}

export interface UseProvidersResult {
  providers: WithId<Provider>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProviders(options: UseProvidersOptions = {}): UseProvidersResult {
  const { state, searchProviders } = useProvidersCache();
  const [providers, setProviders] = useState<WithId<Provider>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { category, city, query, limit = 20 } = options;

  const loadProviders = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      const result = await searchProviders(
        { category, city, query, limit },
        forceRefresh
      );

      setProviders(result);
      setLoading(false);

      if (state.errorSearch) {
        setError(state.errorSearch);
      }
    },
    [searchProviders, category, city, query, limit, state.errorSearch]
  );

  useEffect(() => {
    loadProviders(false);
  }, [loadProviders]);

  const refresh = useCallback(async () => {
    await loadProviders(true);
  }, [loadProviders]);

  return {
    providers,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook for fetching top rated providers (suggestions)
 */
export function useTopProviders(limit: number = 5): UseProvidersResult {
  const { state, loadTopProviders } = useProvidersCache();
  const [providers, setProviders] = useState<WithId<Provider>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      const result = await loadTopProviders(limit, forceRefresh);

      setProviders(result);
      setLoading(false);

      if (state.errorTop) {
        setError(state.errorTop);
      }
    },
    [loadTopProviders, limit, state.errorTop]
  );

  useEffect(() => {
    loadProviders(false);
  }, [loadProviders]);

  const refresh = useCallback(async () => {
    await loadProviders(true);
  }, [loadProviders]);

  return {
    providers,
    loading,
    error,
    refresh,
  };
}

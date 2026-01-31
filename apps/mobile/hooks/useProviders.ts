/**
 * useProviders Hook
 * Fetch and search providers using the cache context with pagination support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProvidersCache } from '../contexts';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseProvidersOptions {
  category?: string | null;
  city?: string | null;
  query?: string | null;
  pageSize?: number;
}

export interface UseProvidersResult {
  providers: WithId<Provider>[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useProviders(options: UseProvidersOptions = {}): UseProvidersResult {
  const { searchProviders, loadMoreProviders, state } = useProvidersCache();
  const [providers, setProviders] = useState<WithId<Provider>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs to prevent race conditions
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const { category = null, city = null, query = null, pageSize = 10 } = options;

  // Only search if query is null/empty or has at least 3 characters
  const effectiveQuery = query && query.length >= 3 ? query : null;

  const loadProviders = useCallback(
    async (forceRefresh = false) => {
      // Increment request ID to cancel stale requests
      const currentRequestId = ++requestIdRef.current;

      // If query is provided but less than 3 chars, don't search yet
      if (query && query.length > 0 && query.length < 3) {
        setProviders([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await searchProviders(
          { category, city, query: effectiveQuery },
          pageSize,
          forceRefresh
        );

        // Only update state if this is still the current request
        if (mountedRef.current && currentRequestId === requestIdRef.current) {
          setProviders(result);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading providers:', err);
        if (mountedRef.current && currentRequestId === requestIdRef.current) {
          setError('Erreur lors du chargement des prestataires');
          setProviders([]);
        }
      } finally {
        if (mountedRef.current && currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [searchProviders, category, city, query, pageSize]
  );

  // Load on mount and when filters change
  useEffect(() => {
    mountedRef.current = true;
    loadProviders(false);

    return () => {
      mountedRef.current = false;
    };
  }, [category, city, effectiveQuery, pageSize]); // Don't include loadProviders to avoid infinite loop

  // Sync local state with cache state
  useEffect(() => {
    setProviders(state.searchResults);
  }, [state.searchResults]);

  const refresh = useCallback(async () => {
    await loadProviders(true);
  }, [loadProviders]);

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.loadingMore) return;

    try {
      await loadMoreProviders();
    } catch (err) {
      console.error('Error loading more providers:', err);
    }
  }, [loadMoreProviders, state.hasMore, state.loadingMore]);

  return {
    providers,
    loading,
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    error,
    refresh,
    loadMore,
  };
}

export interface UseTopProvidersResult {
  providers: WithId<Provider>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching top rated providers (suggestions)
 * No pagination needed for top providers
 */
export function useTopProviders(limit: number = 5): UseTopProvidersResult {
  const { loadTopProviders } = useProvidersCache();
  const [providers, setProviders] = useState<WithId<Provider>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const load = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);

      try {
        const result = await loadTopProviders(limit, forceRefresh);
        if (mountedRef.current) {
          setProviders(result);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading top providers:', err);
        if (mountedRef.current) {
          setError('Erreur lors du chargement des suggestions');
          setProviders([]);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [loadTopProviders, limit]
  );

  useEffect(() => {
    mountedRef.current = true;
    load(false);

    return () => {
      mountedRef.current = false;
    };
  }, [limit]); // Don't include load to avoid infinite loop

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    providers,
    loading,
    error,
    refresh,
  };
}

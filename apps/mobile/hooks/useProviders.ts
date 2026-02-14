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
  region?: string | null;
  query?: string | null;
  pageSize?: number;
  /** Max total results (caps pagination). Undefined = no limit. */
  maxResults?: number;
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
  const loadProvidersRef = useRef<(forceRefresh?: boolean) => Promise<void>>();

  const { category = null, city = null, region = null, query = null, pageSize = 10, maxResults } = options;

  // Only search if query is null/empty or has at least 3 characters
  const effectiveQuery = query && query.length >= 3 ? query : null;

  const loadProviders = useCallback(
    async (forceRefresh = false) => {
      // Increment request ID to cancel stale requests
      const currentRequestId = ++requestIdRef.current;

      // Skip fetching when disabled (pageSize = 0)
      if (pageSize === 0) {
        setProviders([]);
        setLoading(false);
        return;
      }

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
          { category, city, region, query: effectiveQuery },
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
    [searchProviders, category, city, region, query, pageSize]
  );

  // Keep ref in sync so useEffect always calls the latest version
  loadProvidersRef.current = loadProviders;

  // Load on mount and when filters change
  useEffect(() => {
    mountedRef.current = true;
    loadProvidersRef.current?.(false);

    return () => {
      mountedRef.current = false;
    };
  }, [category, city, region, effectiveQuery, pageSize]);

  // Sync local state with cache state
  useEffect(() => {
    setProviders(state.searchResults);
  }, [state.searchResults]);

  const refresh = useCallback(async () => {
    await loadProviders(true);
  }, [loadProviders]);

  // Cap pagination when maxResults is set
  const reachedMax = maxResults != null && providers.length >= maxResults;
  const hasMore = state.hasMore && !reachedMax;

  const loadMore = useCallback(async () => {
    if (!hasMore || state.loadingMore) return;

    try {
      await loadMoreProviders();
    } catch (err) {
      console.error('Error loading more providers:', err);
    }
  }, [loadMoreProviders, hasMore, state.loadingMore]);

  return {
    providers,
    loading,
    loadingMore: state.loadingMore,
    hasMore,
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

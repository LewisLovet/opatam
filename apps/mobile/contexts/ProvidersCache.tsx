/**
 * ProvidersCache Context
 *
 * Cache system for providers to:
 * - Keep providers in memory between navigations
 * - Enable instant navigation to provider detail if already cached
 * - Avoid redundant Firebase calls
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { providerService } from '@booking-app/firebase';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

// ============================================================================
// Types
// ============================================================================

interface SearchParams {
  category?: string | null;
  city?: string | null;
  query?: string | null;
  limit?: number;
}

interface CacheState {
  /** Cache by slug for instant detail access */
  providersBySlug: Record<string, WithId<Provider>>;
  /** Last search results */
  searchResults: WithId<Provider>[];
  /** Search params that generated searchResults */
  searchParams: SearchParams | null;
  /** Top providers (suggestions) */
  topProviders: WithId<Provider>[];
  /** Loading states */
  loadingSearch: boolean;
  loadingTop: boolean;
  /** Error states */
  errorSearch: string | null;
  errorTop: string | null;
}

type CacheAction =
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; payload: { providers: WithId<Provider>[]; params: SearchParams } }
  | { type: 'SEARCH_ERROR'; payload: string }
  | { type: 'TOP_START' }
  | { type: 'TOP_SUCCESS'; payload: WithId<Provider>[] }
  | { type: 'TOP_ERROR'; payload: string }
  | { type: 'ADD_TO_CACHE'; payload: WithId<Provider> }
  | { type: 'CLEAR_CACHE' };

interface ProvidersCacheContextValue {
  /** Current state */
  state: CacheState;
  /** Search providers (uses cache if same params) */
  searchProviders: (params: SearchParams, forceRefresh?: boolean) => Promise<WithId<Provider>[]>;
  /** Load top rated providers */
  loadTopProviders: (limit?: number, forceRefresh?: boolean) => Promise<WithId<Provider>[]>;
  /** Get provider from cache by slug (returns null if not cached) */
  getCachedProvider: (slug: string) => WithId<Provider> | null;
  /** Fetch provider by slug (from cache or Firebase) */
  fetchProviderBySlug: (slug: string) => Promise<WithId<Provider> | null>;
  /** Add a provider to cache manually */
  addToCache: (provider: WithId<Provider>) => void;
  /** Clear all cache */
  clearCache: () => void;
}

// ============================================================================
// Initial State & Reducer
// ============================================================================

const initialState: CacheState = {
  providersBySlug: {},
  searchResults: [],
  searchParams: null,
  topProviders: [],
  loadingSearch: false,
  loadingTop: false,
  errorSearch: null,
  errorTop: null,
};

function cacheReducer(state: CacheState, action: CacheAction): CacheState {
  switch (action.type) {
    case 'SEARCH_START':
      return { ...state, loadingSearch: true, errorSearch: null };

    case 'SEARCH_SUCCESS': {
      // Add all providers to the slug cache
      const newProvidersBySlug = { ...state.providersBySlug };
      action.payload.providers.forEach((provider) => {
        newProvidersBySlug[provider.slug] = provider;
      });
      return {
        ...state,
        loadingSearch: false,
        searchResults: action.payload.providers,
        searchParams: action.payload.params,
        providersBySlug: newProvidersBySlug,
      };
    }

    case 'SEARCH_ERROR':
      return { ...state, loadingSearch: false, errorSearch: action.payload };

    case 'TOP_START':
      return { ...state, loadingTop: true, errorTop: null };

    case 'TOP_SUCCESS': {
      // Add all providers to the slug cache
      const newProvidersBySlug = { ...state.providersBySlug };
      action.payload.forEach((provider) => {
        newProvidersBySlug[provider.slug] = provider;
      });
      return {
        ...state,
        loadingTop: false,
        topProviders: action.payload,
        providersBySlug: newProvidersBySlug,
      };
    }

    case 'TOP_ERROR':
      return { ...state, loadingTop: false, errorTop: action.payload };

    case 'ADD_TO_CACHE':
      return {
        ...state,
        providersBySlug: {
          ...state.providersBySlug,
          [action.payload.slug]: action.payload,
        },
      };

    case 'CLEAR_CACHE':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const ProvidersCacheContext = createContext<ProvidersCacheContextValue | null>(null);

// ============================================================================
// Helper: Compare search params
// ============================================================================

function areParamsEqual(a: SearchParams | null, b: SearchParams): boolean {
  if (!a) return false;
  return (
    (a.category ?? null) === (b.category ?? null) &&
    (a.city ?? null) === (b.city ?? null) &&
    (a.query ?? null) === (b.query ?? null) &&
    (a.limit ?? 20) === (b.limit ?? 20)
  );
}

// ============================================================================
// Provider Component
// ============================================================================

export function ProvidersCacheProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cacheReducer, initialState);

  // Search providers with cache
  const searchProviders = useCallback(
    async (params: SearchParams, forceRefresh = false): Promise<WithId<Provider>[]> => {
      // Check if we already have results for these params
      if (!forceRefresh && areParamsEqual(state.searchParams, params) && state.searchResults.length > 0) {
        return state.searchResults;
      }

      dispatch({ type: 'SEARCH_START' });

      try {
        const filters: {
          category?: string;
          city?: string;
          query?: string;
          limit: number;
        } = { limit: params.limit ?? 20 };

        if (params.category) filters.category = params.category;
        if (params.city) filters.city = params.city;
        if (params.query) filters.query = params.query;

        const result = await providerService.search(filters);
        dispatch({ type: 'SEARCH_SUCCESS', payload: { providers: result, params } });
        return result;
      } catch (err) {
        console.error('Error searching providers:', err);
        dispatch({ type: 'SEARCH_ERROR', payload: 'Erreur lors du chargement des prestataires' });
        return [];
      }
    },
    [state.searchParams, state.searchResults]
  );

  // Load top providers with cache
  const loadTopProviders = useCallback(
    async (limit = 5, forceRefresh = false): Promise<WithId<Provider>[]> => {
      // Check if we already have top providers cached
      if (!forceRefresh && state.topProviders.length > 0) {
        return state.topProviders;
      }

      dispatch({ type: 'TOP_START' });

      try {
        const result = await providerService.getTopRated(limit);
        dispatch({ type: 'TOP_SUCCESS', payload: result });
        return result;
      } catch (err) {
        console.error('Error loading top providers:', err);
        dispatch({ type: 'TOP_ERROR', payload: 'Erreur lors du chargement des suggestions' });
        return [];
      }
    },
    [state.topProviders]
  );

  // Get cached provider by slug
  const getCachedProvider = useCallback(
    (slug: string): WithId<Provider> | null => {
      return state.providersBySlug[slug] || null;
    },
    [state.providersBySlug]
  );

  // Fetch provider by slug (from cache or Firebase)
  const fetchProviderBySlug = useCallback(
    async (slug: string): Promise<WithId<Provider> | null> => {
      // Check cache first
      const cached = state.providersBySlug[slug];
      if (cached) {
        return cached;
      }

      // Fetch from Firebase
      try {
        const provider = await providerService.getBySlug(slug);
        if (provider) {
          dispatch({ type: 'ADD_TO_CACHE', payload: provider });
        }
        return provider;
      } catch (err) {
        console.error('Error fetching provider by slug:', err);
        return null;
      }
    },
    [state.providersBySlug]
  );

  // Add provider to cache
  const addToCache = useCallback((provider: WithId<Provider>) => {
    dispatch({ type: 'ADD_TO_CACHE', payload: provider });
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    dispatch({ type: 'CLEAR_CACHE' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      searchProviders,
      loadTopProviders,
      getCachedProvider,
      fetchProviderBySlug,
      addToCache,
      clearCache,
    }),
    [state, searchProviders, loadTopProviders, getCachedProvider, fetchProviderBySlug, addToCache, clearCache]
  );

  return (
    <ProvidersCacheContext.Provider value={value}>
      {children}
    </ProvidersCacheContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useProvidersCache(): ProvidersCacheContextValue {
  const context = useContext(ProvidersCacheContext);
  if (!context) {
    throw new Error('useProvidersCache must be used within a ProvidersCacheProvider');
  }
  return context;
}

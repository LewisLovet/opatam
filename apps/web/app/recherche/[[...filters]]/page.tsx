'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { providerRepository, type ProviderSearchFilters, type WithId } from '@booking-app/firebase';
import { CATEGORIES, type Provider } from '@booking-app/shared';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  SearchBar,
  CategoryPills,
  CityFilter,
  SortSelect,
  ResultsGrid,
  SearchEmptyState,
  type SortOption,
} from './components';

interface SearchPageProps {
  params: Promise<{ filters?: string[] }>;
}

/**
 * Parse URL filters from catch-all route
 * /recherche -> {}
 * /recherche/beauty -> { category: 'beauty' }
 * /recherche/beauty/paris -> { category: 'beauty', city: 'paris' }
 */
function parseUrlFilters(filters?: string[]): { category?: string; city?: string } {
  if (!filters || filters.length === 0) {
    return {};
  }

  const result: { category?: string; city?: string } = {};

  // First segment is category
  if (filters[0]) {
    const validCategory = CATEGORIES.find((c) => c.id === filters[0]);
    if (validCategory) {
      result.category = filters[0];
    }
  }

  // Second segment is city
  if (filters[1]) {
    result.city = decodeURIComponent(filters[1]);
  }

  return result;
}

/**
 * Build URL path from filters
 */
function buildUrlPath(category?: string, city?: string): string {
  let path = '/recherche';
  if (category) {
    path += `/${category}`;
    if (city) {
      path += `/${encodeURIComponent(city.toLowerCase())}`;
    }
  }
  return path;
}

/**
 * Get category label from id
 */
function getCategoryLabel(categoryId?: string): string | undefined {
  if (!categoryId) return undefined;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  return category?.label;
}

export default function SearchPage({ params }: SearchPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [urlFilters, setUrlFilters] = useState<{ category?: string; city?: string }>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('rating');
  const [providers, setProviders] = useState<WithId<Provider>[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Parse params on mount
  useEffect(() => {
    params.then((resolved) => {
      const parsed = parseUrlFilters(resolved.filters);
      setUrlFilters(parsed);

      // Get query from URL search params
      const urlQuery = searchParams.get('q') || '';
      setQuery(urlQuery);

      // Get sort from URL search params
      const urlSort = searchParams.get('sort') as SortOption | null;
      if (urlSort && ['rating', 'price_asc', 'price_desc', 'newest'].includes(urlSort)) {
        setSort(urlSort);
      }
    });
  }, [params, searchParams]);

  // Fetch providers when filters change
  useEffect(() => {
    async function fetchProviders() {
      setIsLoading(true);
      try {
        const filters: ProviderSearchFilters = {
          category: urlFilters.category,
          city: urlFilters.city,
          query: query || undefined,
        };

        const results = await providerRepository.searchProviders(filters);
        setProviders(results);

        // Extract unique cities for filter dropdown
        const cities = new Set<string>();
        results.forEach((p) => {
          p.cities?.forEach((c) => cities.add(c));
        });
        setAvailableCities(Array.from(cities).sort());
      } catch (error) {
        console.error('Error fetching providers:', error);
        setProviders([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProviders();
  }, [urlFilters, query]);

  // Sort providers client-side
  const sortedProviders = useMemo(() => {
    const sorted = [...providers];
    switch (sort) {
      case 'rating':
        sorted.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
        break;
      case 'price_asc':
        sorted.sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity));
        break;
      case 'price_desc':
        sorted.sort((a, b) => (b.minPrice || 0) - (a.minPrice || 0));
        break;
      case 'newest':
        // Already sorted by createdAt in repository if no rating filter
        break;
    }
    return sorted;
  }, [providers, sort]);

  // Update URL when filters change
  const updateUrl = useCallback(
    (newCategory?: string, newCity?: string, newQuery?: string, newSort?: SortOption) => {
      const path = buildUrlPath(newCategory, newCity);
      const params = new URLSearchParams();

      if (newQuery) {
        params.set('q', newQuery);
      }
      if (newSort && newSort !== 'rating') {
        params.set('sort', newSort);
      }

      const queryString = params.toString();
      const fullPath = queryString ? `${path}?${queryString}` : path;

      router.push(fullPath, { scroll: false });
    },
    [router]
  );

  // Handlers
  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      updateUrl(urlFilters.category, urlFilters.city, newQuery, sort);
    },
    [urlFilters, sort, updateUrl]
  );

  const handleCategoryChange = useCallback(
    (category: string | undefined) => {
      setUrlFilters((prev) => ({ ...prev, category }));
      updateUrl(category, urlFilters.city, query, sort);
    },
    [urlFilters.city, query, sort, updateUrl]
  );

  const handleCityChange = useCallback(
    (city: string | undefined) => {
      setUrlFilters((prev) => ({ ...prev, city }));
      updateUrl(urlFilters.category, city, query, sort);
    },
    [urlFilters.category, query, sort, updateUrl]
  );

  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      setSort(newSort);
      updateUrl(urlFilters.category, urlFilters.city, query, newSort);
    },
    [urlFilters, query, updateUrl]
  );

  const handleClearFilters = useCallback(() => {
    setUrlFilters({});
    setQuery('');
    setSort('rating');
    router.push('/recherche', { scroll: false });
  }, [router]);

  // Page title based on filters
  const pageTitle = useMemo(() => {
    const categoryLabel = getCategoryLabel(urlFilters.category);
    if (categoryLabel && urlFilters.city) {
      return `${categoryLabel} a ${urlFilters.city}`;
    }
    if (categoryLabel) {
      return categoryLabel;
    }
    if (urlFilters.city) {
      return `Prestataires a ${urlFilters.city}`;
    }
    return 'Rechercher un prestataire';
  }, [urlFilters]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {pageTitle}
            </h1>

            {/* Search Bar */}
            <SearchBar initialValue={query} onSearch={handleSearch} />
          </div>

          {/* Filters Row */}
          <div className="mb-6 space-y-4">
            {/* Category Pills */}
            <CategoryPills
              selectedCategory={urlFilters.category}
              onSelect={handleCategoryChange}
            />

            {/* City Filter + Sort */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CityFilter
                selectedCity={urlFilters.city}
                availableCities={availableCities}
                onSelect={handleCityChange}
              />

              <SortSelect value={sort} onChange={handleSortChange} />
            </div>
          </div>

          {/* Results Count */}
          {!isLoading && sortedProviders.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {sortedProviders.length} prestataire{sortedProviders.length > 1 ? 's' : ''} trouve
              {sortedProviders.length > 1 ? 's' : ''}
            </p>
          )}

          {/* Results */}
          {!isLoading && sortedProviders.length === 0 ? (
            <SearchEmptyState
              query={query}
              category={getCategoryLabel(urlFilters.category)}
              city={urlFilters.city}
              onClearFilters={handleClearFilters}
            />
          ) : (
            <ResultsGrid providers={sortedProviders} isLoading={isLoading} />
          )}
        </div>
      </main>

      <Footer variant="simple" />
    </div>
  );
}

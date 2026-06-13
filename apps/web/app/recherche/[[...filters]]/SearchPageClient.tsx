'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { providerRepository, type ProviderSearchFilters, type WithId } from '@booking-app/firebase';
import { CATEGORIES, type Provider } from '@booking-app/shared';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  SearchBar,
  CategoryPills,
  SortSelect,
  ResultsGrid,
  SearchEmptyState,
  type SortOption,
} from './components';

interface SearchPageClientProps {
  /** Server-rendered initial results (SSR for crawlers + first paint). */
  initialProviders: WithId<Provider>[];
  initialCategory?: string;
  initialCity?: string;
  initialQuery: string;
  initialSort: SortOption;
}

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

function getCategoryLabel(categoryId?: string): string | undefined {
  if (!categoryId) return undefined;
  return CATEGORIES.find((c) => c.id === categoryId)?.label;
}

export function SearchPageClient({
  initialProviders,
  initialCategory,
  initialCity,
  initialQuery,
  initialSort,
}: SearchPageClientProps) {
  const router = useRouter();

  // State seeded from the server (so SSR HTML already lists providers).
  const [urlFilters, setUrlFilters] = useState<{ category?: string; city?: string }>({
    category: initialCategory,
    city: initialCity,
  });
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [providers, setProviders] = useState<WithId<Provider>[]>(initialProviders);
  const [isLoading, setIsLoading] = useState(false);

  // Skip the very first fetch — the server already provided fresh results.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    let cancelled = false;
    async function fetchProviders() {
      setIsLoading(true);
      try {
        const filters: ProviderSearchFilters = {
          category: urlFilters.category,
          city: urlFilters.city,
          query: query || undefined,
        };
        const results = await providerRepository.searchProviders(filters);
        if (cancelled) return;
        setProviders(results);
      } catch (error) {
        console.error('Error fetching providers:', error);
        if (!cancelled) setProviders([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchProviders();
    return () => {
      cancelled = true;
    };
  }, [urlFilters, query]);

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
        break;
    }
    return sorted;
  }, [providers, sort]);

  const updateUrl = useCallback(
    (newCategory?: string, newCity?: string, newQuery?: string, newSort?: SortOption) => {
      const path = buildUrlPath(newCategory, newCity);
      const params = new URLSearchParams();
      if (newQuery) params.set('q', newQuery);
      if (newSort && newSort !== 'rating') params.set('sort', newSort);
      const queryString = params.toString();
      router.push(queryString ? `${path}?${queryString}` : path, { scroll: false });
    },
    [router],
  );

  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      updateUrl(urlFilters.category, urlFilters.city, newQuery, sort);
    },
    [urlFilters, sort, updateUrl],
  );

  const handleCategoryChange = useCallback(
    (category: string | undefined) => {
      setUrlFilters((prev) => ({ ...prev, category }));
      updateUrl(category, urlFilters.city, query, sort);
    },
    [urlFilters.city, query, sort, updateUrl],
  );

  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      setSort(newSort);
      updateUrl(urlFilters.category, urlFilters.city, query, newSort);
    },
    [urlFilters, query, updateUrl],
  );

  const handleClearFilters = useCallback(() => {
    setUrlFilters({});
    setQuery('');
    setSort('rating');
    router.push('/recherche', { scroll: false });
  }, [router]);

  const pageTitle = useMemo(() => {
    const categoryLabel = getCategoryLabel(urlFilters.category);
    if (categoryLabel && urlFilters.city) return `${categoryLabel} à ${urlFilters.city}`;
    if (categoryLabel) return categoryLabel;
    if (urlFilters.city) return `Prestataires à ${urlFilters.city}`;
    return 'Rechercher un prestataire';
  }, [urlFilters]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {pageTitle}
            </h1>
            <SearchBar initialValue={query} onSearch={handleSearch} />
          </div>

          <div className="mb-6 space-y-4">
            <CategoryPills
              selectedCategory={urlFilters.category}
              onSelect={handleCategoryChange}
            />

            <div className="flex items-center justify-end">
              <SortSelect value={sort} onChange={handleSortChange} />
            </div>
          </div>

          {!isLoading && sortedProviders.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {sortedProviders.length} prestataire{sortedProviders.length > 1 ? 's' : ''} trouvé
              {sortedProviders.length > 1 ? 's' : ''}
            </p>
          )}

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

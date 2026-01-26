'use client';

import { SearchProviderCard } from '@/components/provider';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

interface ResultsGridProps {
  providers: WithId<Provider>[];
  isLoading?: boolean;
}

/**
 * Skeleton loader for search provider cards
 */
function SearchProviderCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="aspect-[16/10] bg-gray-200 dark:bg-gray-700" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    </div>
  );
}

export function ResultsGrid({ providers, isLoading }: ResultsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SearchProviderCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {providers.map((provider) => (
        <SearchProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { ProviderCard, type ProviderCardData } from './ProviderCard';

interface FeaturedProvidersProps {
  title?: string;
  subtitle?: string;
  providers: ProviderCardData[];
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function FeaturedProviders({
  title = 'Prestataires en vedette',
  subtitle,
  providers,
  viewAllHref,
  viewAllLabel = 'Voir tout',
  className = '',
}: FeaturedProvidersProps) {
  if (providers.length === 0) return null;

  return (
    <section className={className}>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-gray-600 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {viewAllLabel}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      {/* Mobile View All */}
      {viewAllHref && (
        <div className="mt-6 sm:hidden">
          <Link
            href={viewAllHref}
            className="flex items-center justify-center gap-1 w-full px-4 py-2 text-sm font-medium border-2 border-primary-600 text-primary-600 hover:bg-primary-50 dark:border-primary-400 dark:text-primary-400 dark:hover:bg-primary-950 rounded-lg transition-colors"
          >
            {viewAllLabel}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </section>
  );
}

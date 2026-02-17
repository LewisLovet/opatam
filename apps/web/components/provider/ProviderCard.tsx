'use client';

import Link from 'next/link';
import { getCategoryLabel, capitalizeWords } from '@booking-app/shared';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { RatingDisplay } from '../review/RatingDisplay';

/**
 * Type for enriched provider card data
 * Contains provider info + city from location + minimum price from services
 */
export interface ProviderCardData {
  id: string;
  businessName: string;
  photoURL?: string | null;
  category: string;
  description?: string | null;
  isVerified?: boolean;
  // Rating from provider.rating
  rating?: number;
  reviewCount?: number;
  // City from default location or first active location
  city?: string | null;
  // Minimum price from active services
  minPrice?: number | null;
}

interface ProviderCardProps {
  provider: ProviderCardData;
  href?: string;
  className?: string;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
  if (price === 0) return 'Gratuit';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function ProviderCard({ provider, href, className = '' }: ProviderCardProps) {
  const linkHref = href || `/prestataire/${provider.id}`;
  const hasRating = provider.rating !== undefined && provider.reviewCount !== undefined && provider.reviewCount > 0;

  return (
    <Link href={linkHref} className={`block group ${className}`}>
      <Card variant="bordered" className="h-full transition-shadow hover:shadow-md overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Avatar */}
            <Avatar
              src={provider.photoURL}
              alt={provider.businessName}
              size="lg"
              className="flex-shrink-0"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Name + Verified Badge */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                  {provider.businessName}
                </h3>
                {provider.isVerified && (
                  <svg
                    className="w-4 h-4 text-primary-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-label="Vérifié"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Category Badge */}
              <Badge size="sm" className="mt-1">
                {getCategoryLabel(provider.category)}
              </Badge>

              {/* City */}
              {provider.city && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="truncate">{capitalizeWords(provider.city!)}</span>
                </div>
              )}

              {/* Rating + Min Price Row */}
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                {/* Rating */}
                {hasRating && (
                  <RatingDisplay
                    rating={provider.rating!}
                    count={provider.reviewCount}
                    size="sm"
                  />
                )}

                {/* Min Price */}
                {provider.minPrice !== undefined && provider.minPrice !== null && (
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {provider.minPrice === 0 ? 'Gratuit' : `Dès ${formatPrice(provider.minPrice)}`}
                  </span>
                )}
              </div>

              {/* Description (optional, truncated) */}
              {provider.description && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {truncateText(provider.description, 80)}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

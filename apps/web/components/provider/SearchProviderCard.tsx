'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Star, Users, Euro, MapPin } from 'lucide-react';
import { CATEGORIES } from '@booking-app/shared';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { Avatar } from '../ui/Avatar';

interface SearchProviderCardProps {
  provider: WithId<Provider>;
}

/**
 * Format price for display (centimes to euros)
 */
function formatPrice(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros);
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get initials from business name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Minimum number of reviews to display the rating
 */
const MIN_REVIEWS_FOR_RATING = 5;

export function SearchProviderCard({ provider }: SearchProviderCardProps) {
  // Cover image only, fallback to profile photo
  const coverImage = provider.coverPhotoURL || provider.photoURL;
  const profileImage = provider.photoURL;
  
  // Rating display - only show if >= MIN_REVIEWS_FOR_RATING reviews
  const hasEnoughReviews = provider.rating.count >= MIN_REVIEWS_FOR_RATING;
  const reviewCount = provider.rating.count;

  // City display (first city, capitalized)
  const displayCity = provider.cities?.[0] ? capitalize(provider.cities[0]) : null;

  // Member count from subscription (if team plan)
  const memberCount = provider.subscription?.memberCount || 1;
  const isTeam = provider.plan === 'team' && memberCount > 1;

  // Has min price
  const hasMinPrice = provider.minPrice !== null && provider.minPrice !== undefined;

  return (
    <Link
      href={`/p/${provider.slug}`}
      className="block group"
    >
      <article className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-200 hover:shadow-xl hover:border-gray-200 dark:hover:border-gray-600 hover:-translate-y-1">
        {/* Cover Image */}
        <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={provider.businessName}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50">
              <span className="text-5xl font-bold text-primary-600 dark:text-primary-400">
                {getInitials(provider.businessName)}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          {/* Row 1: Business Name + Price Badge */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1 flex-1">
              {provider.businessName}
            </h3>
            
            {/* Price Badge */}
            {hasMinPrice && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                <Euro className="w-3.5 h-3.5" />
                {formatPrice(provider.minPrice!)}
              </span>
            )}
          </div>

          {/* Row 2: Rating + Member count */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {/* Rating Stars */}
            <div className="flex items-center gap-1.5">
              {hasEnoughReviews ? (
                <>
                  {/* Star icons */}
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(provider.rating.average)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-200 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {provider.rating.average.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    ({reviewCount} avis)
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                  Moins de 5 avis
                </span>
              )}
            </div>

            {/* Member count (if team) */}
            {isTeam && (
              <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span>{memberCount} membres</span>
              </div>
            )}
          </div>

          {/* Row 3: Avatar + Name + City */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar
                src={profileImage}
                alt={provider.businessName}
                size="sm"
                className="ring-2 ring-white dark:ring-gray-800 flex-shrink-0"
              />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate">
                {provider.businessName}
              </span>
            </div>
            
            {/* City with icon */}
            {displayCity && (
              <div className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">
                <MapPin className="w-3.5 h-3.5" />
                <span>{displayCity}</span>
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

'use client';

import { Calendar } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { RatingDisplay } from '@/components/review/RatingDisplay';
import { ShareButton } from './ShareButton';

interface ProviderHeroProps {
  provider: {
    businessName: string;
    photoURL: string | null;
    coverPhotoURL: string | null;
    category: string;
    description: string;
    rating: {
      average: number;
      count: number;
    };
    isVerified: boolean;
  };
  nextAvailableDate: string | null;
}

/**
 * Format the next available date for display
 * Returns: "Aujourd'hui", "Demain", or "Lun. 3 février"
 */
function formatNextAvailableDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return "Aujourd'hui";
  }

  if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'Demain';
  }

  // Format as "Lun. 3 février"
  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

export function ProviderHero({ provider, nextAvailableDate }: ProviderHeroProps) {
  const formattedDate = formatNextAvailableDate(nextAvailableDate);
  return (
    <div className="overflow-hidden">
      {/* Cover Photo */}
      <div className="relative h-32 sm:h-48 md:h-64 bg-gray-200 dark:bg-gray-800">
        {provider.coverPhotoURL ? (
          <img
            src={provider.coverPhotoURL}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Share button */}
        <div className="absolute top-4 right-4 z-10">
          <ShareButton businessName={provider.businessName} />
        </div>
      </div>

      {/* Provider Info */}
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-12 sm:-mt-16 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            {/* Avatar */}
            <Avatar
              src={provider.photoURL}
              alt={provider.businessName}
              size="xl"
              className="w-20 h-20 sm:w-28 sm:h-28 border-4 border-white dark:border-gray-900 shadow-lg flex-shrink-0"
            />

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 sm:text-white dark:text-white break-words">
                  {provider.businessName}
                </h1>
                {provider.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium rounded-full">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Vérifié
                  </span>
                )}
              </div>

              <Badge className="mt-2">{provider.category}</Badge>

              {provider.rating.count > 0 && (
                <div className="mt-3">
                  <RatingDisplay rating={provider.rating.average} count={provider.rating.count} size="md" />
                </div>
              )}

              {provider.description && (
                <p className="mt-3 text-gray-600 dark:text-gray-400 line-clamp-1">
                  {provider.description}
                </p>
              )}

              {/* Next Available Date Badge */}
              {formattedDate && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    Prochaine dispo : {formattedDate}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

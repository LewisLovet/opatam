'use client';

import type { Rating } from '@booking-app/shared';
import { Star } from 'lucide-react';

interface ReviewStatsProps {
  rating: Rating;
  onRatingFilter: (rating: number | null) => void;
  activeFilter: number | null;
}

export function ReviewStats({ rating, onRatingFilter, activeFilter }: ReviewStatsProps) {
  const { average, count, distribution } = rating;

  // Calculate max for relative bar widths
  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Left: Average rating */}
        <div className="flex flex-col items-center justify-center sm:min-w-[140px]">
          <div className="text-5xl font-bold text-gray-900 dark:text-white">
            {average > 0 ? average.toFixed(1) : '-'}
          </div>
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= Math.round(average)
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {count} avis
          </p>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-gray-200 dark:bg-gray-700" />

        {/* Right: Distribution bars */}
        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const starCount = distribution[star as keyof typeof distribution];
            const percentage = count > 0 ? Math.round((starCount / count) * 100) : 0;
            const barWidth = count > 0 ? (starCount / maxCount) * 100 : 0;
            const isActive = activeFilter === star;

            return (
              <button
                key={star}
                onClick={() => onRatingFilter(isActive ? null : star)}
                className={`w-full flex items-center gap-3 group hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1.5 -mx-1.5 rounded-lg transition-colors ${
                  isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                {/* Star label */}
                <div className="flex items-center gap-1 w-12 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {star}
                  </span>
                  <Star
                    className={`w-4 h-4 ${
                      isActive
                        ? 'fill-primary-500 text-primary-500'
                        : 'fill-amber-400 text-amber-400'
                    }`}
                  />
                </div>

                {/* Bar */}
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isActive
                        ? 'bg-primary-500'
                        : 'bg-amber-400 group-hover:bg-amber-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Percentage */}
                <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                  {percentage}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use client';

import { Star } from 'lucide-react';

interface RatingDistributionProps {
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  total: number;
}

export function RatingDistribution({ distribution, total }: RatingDistributionProps) {
  const ratings = [5, 4, 3, 2, 1] as const;

  return (
    <div className="space-y-3">
      {ratings.map((rating) => {
        const count = distribution[rating];
        const percentage = total > 0 ? (count / total) * 100 : 0;

        return (
          <div key={rating} className="flex items-center gap-3">
            {/* Rating label */}
            <div className="flex items-center gap-1.5 w-10 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {rating}
              </span>
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            </div>

            {/* Progress bar */}
            <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Percentage */}
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12 text-right">
              {Math.round(percentage)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

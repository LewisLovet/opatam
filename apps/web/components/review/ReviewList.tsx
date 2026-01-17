'use client';

import { ReviewCard } from './ReviewCard';
import { RatingDisplay } from './RatingDisplay';

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  clientName: string;
  clientPhotoURL?: string | null;
  serviceName?: string | null;
  createdAt: Date;
}

interface ReviewListProps {
  reviews: Review[];
  averageRating?: number;
  totalCount?: number;
  showSummary?: boolean;
  className?: string;
}

export function ReviewList({
  reviews,
  averageRating,
  totalCount,
  showSummary = true,
  className = '',
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Aucun avis
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Soyez le premier à donner votre avis !
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Summary */}
      {showSummary && averageRating !== undefined && totalCount !== undefined && (
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {averageRating.toFixed(1)}
              </div>
              <RatingDisplay rating={averageRating} showCount={false} size="sm" />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Basé sur <span className="font-medium text-gray-900 dark:text-white">{totalCount}</span> avis
            </div>
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}

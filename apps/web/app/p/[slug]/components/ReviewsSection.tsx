'use client';

import { ReviewCard } from '@/components/review/ReviewCard';
import { RatingDisplay } from '@/components/review/RatingDisplay';
import { RatingDistribution } from './RatingDistribution';
import { Star } from 'lucide-react';

interface Review {
  id: string;
  clientName: string;
  clientPhoto: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface Rating {
  average: number;
  count: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

interface ReviewsSectionProps {
  reviews: Review[];
  rating: Rating;
}

export function ReviewsSection({ reviews, rating }: ReviewsSectionProps) {
  const hasReviews = rating.count > 0;

  return (
    <section className="py-10 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <Star className="w-6 h-6 text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Avis clients
        </h2>
        {hasReviews && (
          <span className="ml-2 px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-full">
            {rating.count}
          </span>
        )}
      </div>

      {/* Rating Summary - Always visible, 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Left column - Average Rating Card */}
        <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10 rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="text-6xl font-bold text-gray-900 dark:text-white mb-2">
            {hasReviews ? rating.average.toFixed(1) : '-'}
          </div>
          <RatingDisplay rating={hasReviews ? rating.average : 0} showCount={false} size="lg" />
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {hasReviews ? (
              <>
                Base sur <span className="font-semibold text-gray-900 dark:text-white">{rating.count}</span> avis
              </>
            ) : (
              'Aucun avis'
            )}
          </p>
        </div>

        {/* Right column - Distribution (always shown) */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wide">
            Repartition des notes
          </h3>
          <RatingDistribution distribution={rating.distribution} total={rating.count} />
        </div>
      </div>

      {/* Reviews List or Empty State */}
      {hasReviews && reviews.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Derniers avis
          </h3>
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={{
                  id: review.id,
                  rating: review.rating,
                  comment: review.comment,
                  clientName: review.clientName,
                  clientPhotoURL: review.clientPhoto,
                  createdAt: new Date(review.createdAt),
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
          <p className="text-gray-500 dark:text-gray-400">
            Soyez le premier a donner votre avis !
          </p>
        </div>
      )}
    </section>
  );
}

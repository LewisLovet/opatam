'use client';

import type { Review, Member } from '@booking-app/shared';
import { ReviewCard } from './ReviewCard';
import { Star, MessageSquare } from 'lucide-react';

type WithId<T> = { id: string } & T;

interface ReviewListProps {
  reviews: WithId<Review>[];
  members: WithId<Member>[];
  isTeamPlan: boolean;
  loading: boolean;
  hasFilters: boolean;
  onResetFilters: () => void;
}

function ReviewSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded mt-3" />
        </div>
      </div>
    </div>
  );
}

export function ReviewList({
  reviews,
  members,
  isTeamPlan,
  loading,
  hasFilters,
  onResetFilters,
}: ReviewListProps) {
  // Loading state
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <ReviewSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state - no reviews at all
  if (reviews.length === 0 && !hasFilters) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto">
          <Star className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          Aucun avis pour le moment
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          Vos clients pourront laisser un avis apres leur rendez-vous. Les avis vous aident a
          construire votre reputation.
        </p>
      </div>
    );
  }

  // Empty state - no results with filters
  if (reviews.length === 0 && hasFilters) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto">
          <MessageSquare className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          Aucun avis trouve
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Aucun avis ne correspond aux filtres selectionnes.
        </p>
        <button
          onClick={onResetFilters}
          className="mt-4 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
        >
          Reinitialiser les filtres
        </button>
      </div>
    );
  }

  // Get member by ID helper
  const getMember = (memberId: string | null) => {
    if (!memberId) return undefined;
    return members.find((m) => m.id === memberId);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          member={getMember(review.memberId)}
          isTeamPlan={isTeamPlan}
        />
      ))}
    </div>
  );
}

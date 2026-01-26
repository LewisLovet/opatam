'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { reviewRepository, memberService } from '@booking-app/firebase';
import type { Review, Member, Rating } from '@booking-app/shared';
import { Loader2 } from 'lucide-react';
import {
  ReviewStats,
  ReviewFilters,
  ReviewList,
  type ReviewFiltersState,
} from './components';

type WithId<T> = { id: string } & T;

const DEFAULT_FILTERS: ReviewFiltersState = {
  memberId: null,
  rating: null,
};

const DEFAULT_RATING: Rating = {
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export default function AvisPage() {
  const { provider } = useAuth();

  // Data
  const [reviews, setReviews] = useState<WithId<Review>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  // Filters
  const [filters, setFilters] = useState<ReviewFiltersState>(DEFAULT_FILTERS);

  // Loading states
  const [loading, setLoading] = useState(true);

  const isTeamPlan = provider?.plan === 'team' || provider?.plan === 'trial';

  // Use provider rating stats (already denormalized)
  const ratingStats: Rating = provider?.rating || DEFAULT_RATING;

  // Load data
  const loadData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [reviewsData, membersData] = await Promise.all([
        reviewRepository.getAllByProvider(provider.id),
        isTeamPlan ? memberService.getByProvider(provider.id) : Promise.resolve([]),
      ]);

      setReviews(reviewsData);
      setMembers(membersData.filter((m: WithId<Member>) => m.isActive));
    } catch (error) {
      console.error('[Avis] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [provider, isTeamPlan]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter reviews client-side
  const filteredReviews = useMemo(() => {
    let result = reviews;

    if (filters.memberId) {
      result = result.filter((r) => r.memberId === filters.memberId);
    }

    if (filters.rating) {
      result = result.filter((r) => r.rating === filters.rating);
    }

    return result;
  }, [reviews, filters]);

  // Handlers
  const handleFilterChange = (newFilters: Partial<ReviewFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleRatingFilter = (rating: number | null) => {
    setFilters((prev) => ({ ...prev, rating }));
  };

  const hasActiveFilters = filters.memberId !== null || filters.rating !== null;

  // Initial loading
  if (loading && reviews.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Avis clients
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Consultez les avis laisses par vos clients
        </p>
      </div>

      {/* Stats */}
      <ReviewStats
        rating={ratingStats}
        onRatingFilter={handleRatingFilter}
        activeFilter={filters.rating}
      />

      {/* Filters */}
      {(isTeamPlan || reviews.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <ReviewFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            members={members}
            isTeamPlan={isTeamPlan}
          />
        </div>
      )}

      {/* Reviews list */}
      <ReviewList
        reviews={filteredReviews}
        members={members}
        isTeamPlan={isTeamPlan}
        loading={loading}
        hasFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
}

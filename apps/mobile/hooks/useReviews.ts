/**
 * useReviews Hook
 * Fetch reviews for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { reviewService } from '@booking-app/firebase';
import type { Review } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseReviewsResult {
  reviews: WithId<Review>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useReviews(providerId: string | undefined): UseReviewsResult {
  const [reviews, setReviews] = useState<WithId<Review>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    if (!providerId) {
      setReviews([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await reviewService.getPublicProviderReviews(providerId);
      setReviews(result);
    } catch (err) {
      console.error('Error loading reviews:', err);
      setError('Erreur lors du chargement des avis');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  return {
    reviews,
    loading,
    error,
    refresh: loadReviews,
  };
}

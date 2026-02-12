/**
 * useServiceCategories Hook
 * Fetch service categories for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { serviceCategoryRepository } from '@booking-app/firebase';
import type { ServiceCategory } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseServiceCategoriesResult {
  categories: WithId<ServiceCategory>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useServiceCategories(providerId: string | undefined): UseServiceCategoriesResult {
  const [categories, setCategories] = useState<WithId<ServiceCategory>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    if (!providerId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await serviceCategoryRepository.getByProvider(providerId);
      // Filter active and sort by sortOrder
      const active = result
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setCategories(active);
    } catch (err) {
      console.error('Error loading service categories:', err);
      setError('Erreur lors du chargement des catégories');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    categories,
    loading,
    error,
    refresh: loadCategories,
  };
}

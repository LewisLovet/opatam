'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminReviewService } from '@/services/admin/adminReviewService';
import type { ReviewFilters as ReviewFiltersType, PaginatedResult } from '@/services/admin/types';
import { ReviewFilters } from './components/ReviewFilters';
import { ReviewTable } from './components/ReviewTable';
import { Loader } from '@/components/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminReviewsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ReviewFiltersType>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResult<any> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReviews = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await adminReviewService.getReviews(user.id, filters, page);
      setResult(data);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filters, page]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const handleToggleVisibility = async (reviewId: string, isPublic: boolean) => {
    if (!user?.id) return;
    try {
      await adminReviewService.toggleReviewVisibility(user.id, reviewId, isPublic);
      await loadReviews();
    } catch (err) {
      console.error('Error toggling visibility:', err);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!user?.id) return;
    try {
      await adminReviewService.deleteReview(user.id, reviewId);
      await loadReviews();
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  };

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Avis</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {result
            ? `${result.total} avis${result.total > 1 ? '' : ''} — Mod\u00e9ration des avis clients`
            : 'Chargement...'}
        </p>
      </div>

      {/* Filters */}
      <ReviewFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader size="lg" />
        </div>
      ) : (
        <>
          <ReviewTable
            items={result?.items || []}
            onToggleVisibility={handleToggleVisibility}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} sur {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

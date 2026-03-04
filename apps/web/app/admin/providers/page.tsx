'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminProviderService } from '@/services/admin';
import type { ProviderFilters as ProviderFiltersType, PaginatedResult } from '@/services/admin/types';
import { ProviderFilters } from './components/ProviderFilters';
import { ProviderTable } from './components/ProviderTable';
import { Loader } from '@/components/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminProvidersPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ProviderFiltersType>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResult<any> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProviders = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await adminProviderService.getProviders(user.id, filters, page);
      setResult(data);
    } catch (err) {
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filters, page]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prestataires</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {result ? `${result.total} prestataire${result.total > 1 ? 's' : ''}` : 'Chargement...'}
        </p>
      </div>

      {/* Filters */}
      <ProviderFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader size="lg" />
        </div>
      ) : (
        <>
          <ProviderTable items={result?.items || []} />

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

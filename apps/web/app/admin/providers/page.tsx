'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminProviderService } from '@/services/admin';
import type { ProviderFilters as ProviderFiltersType, PaginatedResult } from '@/services/admin/types';
import { ProviderFilters } from './components/ProviderFilters';
import { ProviderTable } from './components/ProviderTable';
import { Loader, Button } from '@/components/ui';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export default function AdminProvidersPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ProviderFiltersType>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResult<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixingRegions, setFixingRegions] = useState(false);
  const [fixResult, setFixResult] = useState<{ total: number; fixed: number; skipped: number } | null>(null);

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

  const handleFixAllRegions = async () => {
    if (!user?.id) return;
    if (!confirm('Corriger la région de tous les prestataires sans région ? Cette opération peut prendre quelques instants.')) return;
    setFixingRegions(true);
    setFixResult(null);
    try {
      const res = await adminProviderService.fixAllRegions(user.id);
      setFixResult(res);
      // Reload providers list to reflect changes
      loadProviders();
    } catch (err) {
      console.error('Error fixing regions:', err);
      alert('Erreur lors de la correction des régions');
    } finally {
      setFixingRegions(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prestataires</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {result ? `${result.total} prestataire${result.total > 1 ? 's' : ''}` : 'Chargement...'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFixAllRegions}
          loading={fixingRegions}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${fixingRegions ? 'animate-spin' : ''}`} />
          Corriger les régions manquantes
        </Button>
      </div>

      {/* Fix result banner */}
      {fixResult && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 text-sm">
          <p className="font-medium text-blue-800 dark:text-blue-300">
            Correction terminée : {fixResult.fixed} corrigé{fixResult.fixed > 1 ? 's' : ''} sur {fixResult.total} sans région
            {fixResult.skipped > 0 && ` (${fixResult.skipped} non résolu${fixResult.skipped > 1 ? 's' : ''})`}
          </p>
        </div>
      )}

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

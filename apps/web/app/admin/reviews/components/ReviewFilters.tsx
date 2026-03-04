'use client';

import { Search } from 'lucide-react';
import type { ReviewFilters as ReviewFiltersType } from '@/services/admin/types';

interface ReviewFiltersProps {
  filters: ReviewFiltersType;
  onChange: (filters: ReviewFiltersType) => void;
}

export function ReviewFilters({ filters, onChange }: ReviewFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom du client..."
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        {/* Min rating filter */}
        <select
          value={filters.minRating || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              minRating: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Toutes les notes</option>
          <option value="1">1 {'\u2605'} et +</option>
          <option value="2">2 {'\u2605'} et +</option>
          <option value="3">3 {'\u2605'} et +</option>
          <option value="4">4 {'\u2605'} et +</option>
          <option value="5">5 {'\u2605'}</option>
        </select>

        {/* Visibility filter */}
        <select
          value={filters.isPublic || 'all'}
          onChange={(e) =>
            onChange({ ...filters, isPublic: e.target.value as 'true' | 'false' | 'all' })
          }
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="all">Toutes les visibilit&#233;s</option>
          <option value="true">Public</option>
          <option value="false">Priv&#233;</option>
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Du</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Au</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>
    </div>
  );
}

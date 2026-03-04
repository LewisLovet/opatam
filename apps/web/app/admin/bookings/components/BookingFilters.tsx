'use client';

import { Search } from 'lucide-react';
import type { BookingFilters as BookingFiltersType } from '@/services/admin/types';

interface BookingFiltersProps {
  filters: BookingFiltersType;
  onChange: (filters: BookingFiltersType) => void;
}

export function BookingFilters({ filters, onChange }: BookingFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Search + Status */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par client, prestataire, service..."
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        {/* Status filter */}
        <select
          value={filters.status || 'all'}
          onChange={(e) => onChange({ ...filters, status: e.target.value as any })}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirm&eacute;</option>
          <option value="cancelled">Annul&eacute;</option>
          <option value="noshow">Absent</option>
        </select>
      </div>

      {/* Row 2: Date range */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Du</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <label className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Au</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>
    </div>
  );
}

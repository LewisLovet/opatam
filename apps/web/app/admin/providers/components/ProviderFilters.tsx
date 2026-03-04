'use client';

import { Search } from 'lucide-react';
import type { ProviderFilters as ProviderFiltersType } from '@/services/admin/types';

interface ProviderFiltersProps {
  filters: ProviderFiltersType;
  onChange: (filters: ProviderFiltersType) => void;
}

export function ProviderFilters({ filters, onChange }: ProviderFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par nom..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Plan filter */}
      <select
        value={filters.plan || ''}
        onChange={(e) => onChange({ ...filters, plan: e.target.value || undefined })}
        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <option value="">Tous les plans</option>
        <option value="trial">Trial</option>
        <option value="solo">Solo</option>
        <option value="team">Team</option>
        <option value="test">Test</option>
      </select>

      {/* Published filter */}
      <select
        value={filters.isPublished || 'all'}
        onChange={(e) => onChange({ ...filters, isPublished: e.target.value as any })}
        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <option value="all">Publication</option>
        <option value="true">Publié</option>
        <option value="false">Non publié</option>
      </select>

      {/* Verified filter */}
      <select
        value={filters.isVerified || 'all'}
        onChange={(e) => onChange({ ...filters, isVerified: e.target.value as any })}
        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <option value="all">Vérification</option>
        <option value="true">Vérifié</option>
        <option value="false">Non vérifié</option>
      </select>
    </div>
  );
}

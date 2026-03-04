'use client';

import { Search } from 'lucide-react';
import type { UserFilters as UserFiltersType } from '@/services/admin/types';

interface UserFiltersProps {
  filters: UserFiltersType;
  onChange: (filters: UserFiltersType) => void;
}

export function UserFilters({ filters, onChange }: UserFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par nom, email, téléphone..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Role filter */}
      <select
        value={filters.role || 'all'}
        onChange={(e) => onChange({ ...filters, role: e.target.value as any })}
        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <option value="all">Tous les rôles</option>
        <option value="client">Clients</option>
        <option value="provider">Prestataires</option>
        <option value="both">Client + Prestataire</option>
      </select>
    </div>
  );
}

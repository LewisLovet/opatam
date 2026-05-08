'use client';

/**
 * Client list filters — search box + tag chips + sort dropdown.
 *
 * Stays purely presentational: the parent owns the filter state and
 * applies it client-side over the full provider client base. The
 * dataset is small enough (a few hundred docs at most) that a
 * round-trip-free filter is fine and feels instantaneous.
 */

import { Search, X } from 'lucide-react';
import type { ProviderClientTag } from '@booking-app/shared';

export type SortKey =
  | 'lastBooking-desc'
  | 'lastBooking-asc'
  | 'name-asc'
  | 'revenue-desc'
  | 'bookings-desc';

export interface FiltersState {
  search: string;
  tags: ProviderClientTag[];
  sort: SortKey;
}

interface TagOption {
  value: ProviderClientTag;
  label: string;
  hint: string;
}

/** Order matters — chips render in the order shown. New / VIP /
 *  Habitué first since those are the most actionable for the pro. */
export const TAG_OPTIONS: TagOption[] = [
  { value: 'new', label: 'Nouveau', hint: 'Première visite < 30 j' },
  { value: 'regular', label: 'Habitué', hint: '≥3 RDV récents' },
  { value: 'vip', label: 'VIP', hint: '≥10 RDV ou ≥500 € cumulés' },
  { value: 'at_risk', label: 'À risque', hint: 'Pas vu depuis 60-180 j' },
  { value: 'lost', label: 'Perdu', hint: 'Pas vu depuis +180 j' },
  { value: 'noshow_prone', label: 'Absent fréquent', hint: '>20% no-show' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'lastBooking-desc', label: 'Dernière visite ↓' },
  { value: 'lastBooking-asc', label: 'Dernière visite ↑' },
  { value: 'name-asc', label: 'Nom (A → Z)' },
  { value: 'revenue-desc', label: 'CA cumulé ↓' },
  { value: 'bookings-desc', label: 'Nombre de RDV ↓' },
];

interface Props {
  filters: FiltersState;
  totalCount: number;
  filteredCount: number;
  onChange: (next: FiltersState) => void;
}

export function ClientFilters({
  filters,
  totalCount,
  filteredCount,
  onChange,
}: Props) {
  const hasActiveFilters =
    filters.search.length > 0 || filters.tags.length > 0;

  const toggleTag = (tag: ProviderClientTag) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  };

  const reset = () => {
    onChange({ ...filters, search: '', tags: [] });
  };

  return (
    <div className="space-y-4">
      {/* Search + sort row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Rechercher par nom, email ou téléphone…"
            className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {filters.search.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Effacer la recherche"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={filters.sort}
          onChange={(e) =>
            onChange({ ...filters, sort: e.target.value as SortKey })
          }
          className="sm:w-56 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tag chips */}
      <div className="flex flex-wrap items-center gap-2">
        {TAG_OPTIONS.map((tag) => {
          const active = filters.tags.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() => toggleTag(tag.value)}
              title={tag.hint}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                active
                  ? 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500',
              ].join(' ')}
            >
              {tag.label}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {filteredCount === totalCount
          ? `${totalCount} client${totalCount > 1 ? 's' : ''}`
          : `${filteredCount} sur ${totalCount}`}
      </p>
    </div>
  );
}

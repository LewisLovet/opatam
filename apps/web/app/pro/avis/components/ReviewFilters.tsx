'use client';

import type { Member } from '@booking-app/shared';
import { X } from 'lucide-react';

type WithId<T> = { id: string } & T;

export interface ReviewFiltersState {
  memberId: string | null;
  rating: number | null;
}

interface ReviewFiltersProps {
  filters: ReviewFiltersState;
  onChange: (filters: Partial<ReviewFiltersState>) => void;
  onReset: () => void;
  members: WithId<Member>[];
  isTeamPlan: boolean;
}

export function ReviewFilters({
  filters,
  onChange,
  onReset,
  members,
  isTeamPlan,
}: ReviewFiltersProps) {
  const hasActiveFilters = filters.memberId !== null || filters.rating !== null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Member filter (Team plan only) */}
      {isTeamPlan && members.length > 0 && (
        <select
          value={filters.memberId || 'all'}
          onChange={(e) =>
            onChange({ memberId: e.target.value === 'all' ? null : e.target.value })
          }
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Tous les membres</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      )}

      {/* Rating filter */}
      <select
        value={filters.rating || 'all'}
        onChange={(e) =>
          onChange({ rating: e.target.value === 'all' ? null : Number(e.target.value) })
        }
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="all">Toutes les notes</option>
        <option value="5">5 etoiles</option>
        <option value="4">4 etoiles</option>
        <option value="3">3 etoiles</option>
        <option value="2">2 etoiles</option>
        <option value="1">1 etoile</option>
      </select>

      {/* Reset button */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Reinitialiser
        </button>
      )}
    </div>
  );
}

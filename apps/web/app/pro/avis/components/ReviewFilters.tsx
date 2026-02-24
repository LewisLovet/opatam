'use client';

import type { Member } from '@booking-app/shared';
import { X, Star, User } from 'lucide-react';
import { FilterChip } from '../../calendrier/components/FilterChip';

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

const RATING_OPTIONS = [
  { id: '5', label: '5 étoiles' },
  { id: '4', label: '4 étoiles' },
  { id: '3', label: '3 étoiles' },
  { id: '2', label: '2 étoiles' },
  { id: '1', label: '1 étoile' },
];

export function ReviewFilters({
  filters,
  onChange,
  onReset,
  members,
  isTeamPlan,
}: ReviewFiltersProps) {
  const hasActiveFilters = filters.memberId !== null || filters.rating !== null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Member filter (Team plan only) */}
      {isTeamPlan && members.length > 0 && (
        <FilterChip
          label="membres"
          value={filters.memberId}
          options={members.map((member) => ({
            id: member.id,
            label: member.name,
            color: member.color,
          }))}
          icon={<User className="w-4 h-4" />}
          allLabel="Tous les"
          onChange={(value) => onChange({ memberId: value })}
        />
      )}

      {/* Rating filter */}
      <FilterChip
        label="notes"
        value={filters.rating !== null ? String(filters.rating) : null}
        options={RATING_OPTIONS}
        icon={<Star className="w-4 h-4" />}
        allLabel="Toutes les"
        onChange={(value) => onChange({ rating: value ? Number(value) : null })}
      />

      {/* Reset button */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}

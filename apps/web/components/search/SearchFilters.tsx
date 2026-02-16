'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFiltersProps {
  categories: FilterOption[];
  selectedCategory?: string | null;
  onCategoryChange: (category: string | null) => void;
  sortOptions?: FilterOption[];
  selectedSort?: string;
  onSortChange?: (sort: string) => void;
  onReset?: () => void;
  className?: string;
}

export function SearchFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  sortOptions = [
    { value: 'relevance', label: 'Pertinence' },
    { value: 'rating', label: 'Mieux notés' },
    { value: 'distance', label: 'Distance' },
  ],
  selectedSort = 'relevance',
  onSortChange,
  onReset,
  className = '',
}: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = selectedCategory !== null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filter Toggle Button (Mobile) */}
      <div className="flex items-center justify-between gap-4 md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          }
        >
          Filtres
          {hasActiveFilters && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-full">
              1
            </span>
          )}
        </Button>

        {/* Sort Dropdown */}
        <select
          value={selectedSort}
          onChange={(e) => onSortChange?.(e.target.value)}
          className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filters Content */}
      <div className={`${isExpanded ? 'block' : 'hidden'} md:block`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 md:p-0 bg-gray-50 dark:bg-gray-800/50 md:bg-transparent rounded-lg md:rounded-none">
          {/* Category Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 md:hidden">
              Catégorie
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCategoryChange(null)}
                className={`
                  px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${
                    selectedCategory === null
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                `}
              >
                Toutes
              </button>
              {categories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => onCategoryChange(category.value)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${
                      selectedCategory === category.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Sort & Reset */}
          <div className="hidden md:flex items-center gap-3">
            <select
              value={selectedSort}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {hasActiveFilters && onReset && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                Réinitialiser
              </Button>
            )}
          </div>

          {/* Mobile Reset */}
          {hasActiveFilters && onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="md:hidden">
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

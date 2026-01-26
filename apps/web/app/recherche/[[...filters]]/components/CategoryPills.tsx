'use client';

import { useState } from 'react';
import { CATEGORIES } from '@booking-app/shared';

interface CategoryPillsProps {
  selectedCategory?: string;
  onSelect: (category: string | undefined) => void;
}

const VISIBLE_COUNT_DESKTOP = 6;

export function CategoryPills({ selectedCategory, onSelect }: CategoryPillsProps) {
  const [showAll, setShowAll] = useState(false);

  // Get pill class based on selection state
  const getPillClass = (isSelected: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
      isSelected
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`;

  // Categories to show on desktop (limited or all)
  const visibleCategories = showAll ? CATEGORIES : CATEGORIES.slice(0, VISIBLE_COUNT_DESKTOP);
  const hasMore = CATEGORIES.length > VISIBLE_COUNT_DESKTOP;

  return (
    <>
      {/* Mobile: horizontal scroll */}
      <div className="md:hidden -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2">
          {/* All categories pill */}
          <button
            onClick={() => onSelect(undefined)}
            className={`${getPillClass(!selectedCategory)} snap-start`}
          >
            Tous
          </button>

          {/* All category pills (scrollable on mobile) */}
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`${getPillClass(selectedCategory === cat.id)} snap-start`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: flex wrap with "Voir plus/moins" */}
      <div className="hidden md:flex flex-wrap gap-2">
        {/* All categories pill */}
        <button
          onClick={() => onSelect(undefined)}
          className={getPillClass(!selectedCategory)}
        >
          Tous
        </button>

        {/* Visible category pills */}
        {visibleCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={getPillClass(selectedCategory === cat.id)}
          >
            {cat.label}
          </button>
        ))}

        {/* Voir plus / Voir moins button */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-4 py-2 rounded-full text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-1"
          >
            {showAll ? (
              <>
                Voir moins
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                Voir plus
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}

'use client';

import { type ReactNode } from 'react';

interface Category {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface CategoryPillsProps {
  categories: Category[];
  selectedId?: string | null;
  onSelect: (categoryId: string | null) => void;
  className?: string;
}

export function CategoryPills({
  categories,
  selectedId,
  onSelect,
  className = '',
}: CategoryPillsProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible sm:pb-0 ${className}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* "Tous" pill */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`
          flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap
          ${
            selectedId === null
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }
        `}
      >
        Tous
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`
            flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap
            ${
              selectedId === category.id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }
          `}
        >
          {category.icon && <span className="w-4 h-4">{category.icon}</span>}
          {category.label}
        </button>
      ))}
    </div>
  );
}

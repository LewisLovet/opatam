'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';

type SearchSize = 'default' | 'large';

interface SearchBarProps {
  onSearch: (query: string, location: string) => void;
  defaultQuery?: string;
  defaultLocation?: string;
  size?: SearchSize;
  className?: string;
}

const sizeStyles: Record<SearchSize, { input: string; button: string; icon: string }> = {
  default: {
    input: 'px-10 py-2.5 text-base',
    button: 'px-4 py-2.5',
    icon: 'w-4 h-4 left-3',
  },
  large: {
    input: 'px-12 py-4 text-base',
    button: 'px-6 py-4',
    icon: 'w-5 h-5 left-4',
  },
};

export function SearchBar({
  onSearch,
  defaultQuery = '',
  defaultLocation = '',
  size = 'default',
  className = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [location, setLocation] = useState(defaultLocation);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query.trim(), location.trim());
  };

  const styles = sizeStyles[size];

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 bg-white dark:bg-gray-800 rounded-xl sm:rounded-full border border-gray-200 dark:border-gray-700 p-2 sm:p-1 shadow-sm">
        {/* Query Input */}
        <div className="relative flex-1">
          <svg
            className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Que recherchez-vous ?"
            className={`w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${styles.input}`}
          />
        </div>

        {/* Divider (desktop only) */}
        <div className="hidden sm:block w-px bg-gray-200 dark:bg-gray-700 my-2" />

        {/* Location Input */}
        <div className="relative flex-1">
          <svg
            className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Où ? (ville)"
            className={`w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${styles.input}`}
          />
        </div>

        {/* Search Button */}
        <Button
          type="submit"
          size={size === 'large' ? 'lg' : 'md'}
          className={`w-full sm:w-auto rounded-lg sm:rounded-full ${styles.button}`}
        >
          <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>Rechercher</span>
        </Button>
      </div>
    </form>
  );
}

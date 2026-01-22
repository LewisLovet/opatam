'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

interface FilterOption {
  id: string;
  label: string;
}

interface FilterChipProps {
  label: string;
  value: string | null; // null = "Tous"
  options: FilterOption[];
  icon: React.ReactNode;
  allLabel?: string;
  onChange: (value: string | null) => void;
}

export function FilterChip({
  label,
  value,
  options,
  icon,
  allLabel = 'Tous',
  onChange,
}: FilterChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const selectedOption = value ? options.find((opt) => opt.id === value) : null;
  const isFiltered = value !== null;
  const displayLabel = selectedOption ? selectedOption.label : `${allLabel} ${label.toLowerCase()}`;

  const handleSelect = (optionId: string | null) => {
    onChange(optionId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Chip - use div to avoid nested button issue */}
      <div
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-200 border cursor-pointer select-none
          ${isFiltered
            ? 'bg-primary-500 text-white border-primary-500 hover:bg-primary-600'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
        `}
        role="combobox"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={`flex-shrink-0 ${isFiltered ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
          {icon}
        </span>
        <span className="truncate max-w-[120px]">{displayLabel}</span>
        {isFiltered ? (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 p-0.5 rounded-full hover:bg-primary-400 transition-colors"
            aria-label="Effacer le filtre"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 min-w-[180px] max-h-[240px] overflow-y-auto
            bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700
            py-1 z-50"
          role="listbox"
        >
          {/* "All" option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-sm text-left
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
              ${value === null ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300'}
            `}
            role="option"
            aria-selected={value === null}
          >
            <span className="flex-1">{allLabel} {label.toLowerCase()}</span>
            {value === null && <Check className="w-4 h-4 text-primary-500" />}
          </button>

          {/* Separator */}
          {options.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          )}

          {/* Options */}
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                ${value === option.id ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300'}
              `}
              role="option"
              aria-selected={value === option.id}
            >
              <span className="flex-1 truncate">{option.label}</span>
              {value === option.id && <Check className="w-4 h-4 text-primary-500" />}
            </button>
          ))}

          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
              Aucune option disponible
            </div>
          )}
        </div>
      )}
    </div>
  );
}

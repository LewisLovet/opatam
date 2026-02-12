'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

// --- Types ---

export interface AddressSuggestion {
  label: string;
  name: string;
  city: string;
  postcode: string;
  street: string | null;
  housenumber: string | null;
  context: string;
  citycode: string;
  type: string;
  score: number;
  coordinates: { latitude: number; longitude: number };
}

export interface AddressAutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** Minimum characters before triggering search */
  minChars?: number;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Max results */
  limit?: number;
  /** Filter by postcode */
  postcode?: string;
  /** Filter by type: housenumber, street, locality, municipality */
  type?: 'housenumber' | 'street' | 'locality' | 'municipality';
  className?: string;
}

// --- API ---

const API_URL = 'https://api-adresse.data.gouv.fr/search';

async function searchAddress(
  query: string,
  options?: { limit?: number; postcode?: string; type?: string }
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: String(options?.limit ?? 5) });
  if (options?.postcode) params.set('postcode', options.postcode);
  if (options?.type) params.set('type', options.type);

  const response = await fetch(`${API_URL}?${params}`);
  if (!response.ok) return [];

  const data = await response.json();
  return (data.features ?? []).map((f: any) => ({
    label: f.properties.label,
    name: f.properties.name,
    city: f.properties.city,
    postcode: f.properties.postcode,
    street: f.properties.street ?? null,
    housenumber: f.properties.housenumber ?? null,
    context: f.properties.context,
    citycode: f.properties.citycode,
    type: f.properties.type,
    score: f.properties.score,
    coordinates: {
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    },
  }));
}

// --- Component ---

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  placeholder = 'Saisissez une adresse...',
  error,
  hint,
  required,
  disabled,
  minChars = 3,
  debounceMs = 300,
  limit = 5,
  postcode,
  type,
  className = '',
}: AddressAutocompleteProps) {
  const generatedId = useId();
  const inputId = `address-${generatedId}`;
  const listboxId = `address-listbox-${generatedId}`;

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const hasError = !!error;

  // Debounced search
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (query.length < minChars) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await searchAddress(query, { limit, postcode, type });
          setSuggestions(results);
          setIsOpen(results.length > 0);
          setActiveIndex(-1);
        } catch {
          setSuggestions([]);
          setIsOpen(false);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [minChars, debounceMs, limit, postcode, type]
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    debouncedSearch(val);
  };

  // Handle suggestion selection
  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label);
    onSelect(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  // Handle clear
  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
          {required && <span className="text-error-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 text-gray-400" />
          )}
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-invalid={hasError}
          className={`
            w-full pl-10 pr-9 py-2 rounded-lg border text-base
            text-gray-900 dark:text-gray-100
            bg-white dark:bg-gray-800
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
            ${hasError
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
            }
          `}
        />

        {/* Clear button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            tabIndex={-1}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.label + index}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`
                flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors
                ${index === activeIndex
                  ? 'bg-primary-50 dark:bg-primary-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
                ${index > 0 ? 'border-t border-gray-100 dark:border-gray-700/50' : ''}
              `}
            >
              <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                index === activeIndex ? 'text-primary-500' : 'text-gray-400'
              }`} />
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${
                  index === activeIndex
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {suggestion.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {suggestion.postcode} {suggestion.city} — {suggestion.context}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Error / Hint */}
      {error && (
        <p className="mt-1.5 text-sm text-error-600 dark:text-error-400" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}

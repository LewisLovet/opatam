'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

// --- Constants ---

/** Countries supported by Opatam (France + neighboring EU countries) */
export const OPATAM_SUPPORTED_COUNTRIES = ['fr', 'be', 'lu', 'ch', 'de', 'es', 'it', 'nl', 'pt'];

// --- Types ---

export interface GoogleAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

export interface GoogleAddressSuggestion {
  /** Full formatted address */
  formattedAddress: string;
  /** Structured address components */
  streetNumber: string | null;
  route: string | null;
  locality: string | null;
  postalCode: string | null;
  country: string | null;
  countryCode: string | null;
  adminArea1: string | null; // Region / Canton / Bundesland
  adminArea2: string | null; // Department / Province
  /** GPS coordinates */
  coordinates: { latitude: number; longitude: number } | null;
  /** Place ID for further lookups */
  placeId: string;
  /** Raw address components from Google */
  rawComponents: GoogleAddressComponent[];
}

export interface GoogleAddressAutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: GoogleAddressSuggestion) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** ISO country codes to restrict search. Defaults to OPATAM_SUPPORTED_COUNTRIES */
  countries?: string[];
  /** Minimum characters before triggering search */
  minChars?: number;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Max results */
  limit?: number;
  /** Google API key (falls back to NEXT_PUBLIC_GOOGLE_MAPS_API_KEY env var) */
  apiKey?: string;
  className?: string;
}

// --- API ---

interface AutocompletePrediction {
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat?: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

/**
 * Generate a unique session token (UUID v4).
 * Session tokens group autocomplete + place details into one billing session.
 */
function generateSessionToken(): string {
  return crypto.randomUUID();
}

async function fetchAutocompleteSuggestions(
  query: string,
  apiKey: string,
  options: {
    countries?: string[];
    limit?: number;
    sessionToken: string;
  }
): Promise<AutocompletePrediction[]> {
  const body: Record<string, unknown> = {
    input: query,
    sessionToken: options.sessionToken,
    includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route', 'locality'],
  };

  if (options.countries && options.countries.length > 0) {
    body.includedRegionCodes = options.countries;
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places:autocomplete?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    console.error('[GoogleAutocomplete] API error:', response.status, errorBody);
    return [];
  }

  const data = await response.json();
  return (data.suggestions ?? []).slice(0, options.limit ?? 5);
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  sessionToken: string
): Promise<GoogleAddressSuggestion | null> {
  // Place Details must go through API route (Google blocks CORS on this endpoint)
  const params = new URLSearchParams({ placeId, sessionToken });

  const response = await fetch(`/api/google-places/details?${params}`);

  if (!response.ok) {
    console.error('[GoogleAutocomplete] Place Details error:', response.status);
    return null;
  }

  const place = await response.json();

  const components: GoogleAddressComponent[] = place.addressComponents ?? [];

  const getComponent = (type: string): GoogleAddressComponent | undefined =>
    components.find((c: GoogleAddressComponent) => c.types.includes(type));

  const streetNumber = getComponent('street_number');
  const route = getComponent('route');
  const locality =
    getComponent('locality') ?? getComponent('postal_town') ?? getComponent('administrative_area_level_3');
  const postalCode = getComponent('postal_code');
  const country = getComponent('country');
  const adminArea1 = getComponent('administrative_area_level_1');
  const adminArea2 = getComponent('administrative_area_level_2');

  return {
    formattedAddress: place.formattedAddress ?? '',
    streetNumber: streetNumber?.longText ?? null,
    route: route?.longText ?? null,
    locality: locality?.longText ?? null,
    postalCode: postalCode?.longText ?? null,
    country: country?.longText ?? null,
    countryCode: country?.shortText ?? null,
    adminArea1: adminArea1?.longText ?? null,
    adminArea2: adminArea2?.longText ?? null,
    coordinates: place.location
      ? { latitude: place.location.latitude, longitude: place.location.longitude }
      : null,
    placeId: place.id ?? placeId,
    rawComponents: components,
  };
}

// --- Component ---

export function GoogleAddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  placeholder = 'Saisissez une adresse...',
  error,
  hint,
  required,
  disabled,
  countries = OPATAM_SUPPORTED_COUNTRIES,
  minChars = 3,
  debounceMs = 300,
  limit = 5,
  apiKey,
  className = '',
}: GoogleAddressAutocompleteProps) {
  const resolvedApiKey = apiKey ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const generatedId = useId();
  const inputId = `google-address-${generatedId}`;
  const listboxId = `google-address-listbox-${generatedId}`;

  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSelectingDetails, setIsSelectingDetails] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const sessionTokenRef = useRef<string>(generateSessionToken());

  const hasError = !!error;
  const noApiKey = !resolvedApiKey;

  // Debounced search
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (query.length < minChars) {
        setPredictions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      if (noApiKey) return;

      setIsLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await fetchAutocompleteSuggestions(query, resolvedApiKey, {
            countries,
            limit,
            sessionToken: sessionTokenRef.current,
          });
          setPredictions(results);
          setIsOpen(results.length > 0);
          setActiveIndex(-1);
        } catch {
          setPredictions([]);
          setIsOpen(false);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [minChars, debounceMs, limit, countries, resolvedApiKey, noApiKey]
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    debouncedSearch(val);
  };

  // Handle prediction selection → fetch Place Details
  const handleSelect = async (prediction: AutocompletePrediction) => {
    const { placeId, text } = prediction.placePrediction;

    onChange(text.text);
    setPredictions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setIsSelectingDetails(true);

    try {
      const details = await fetchPlaceDetails(placeId, resolvedApiKey, sessionTokenRef.current);
      if (details) {
        onChange(details.formattedAddress);
        onSelect(details);
      }
    } catch (err) {
      console.error('[GoogleAutocomplete] Failed to fetch place details:', err);
    } finally {
      setIsSelectingDetails(false);
      // Reset session token after a completed session
      sessionTokenRef.current = generateSessionToken();
    }
  };

  // Handle clear
  const handleClear = () => {
    onChange('');
    setPredictions([]);
    setIsOpen(false);
    // Reset session token on clear
    sessionTokenRef.current = generateSessionToken();
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < predictions.length) {
          handleSelect(predictions[activeIndex]);
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

      {/* No API key warning */}
      {noApiKey && (
        <div className="mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400">
          Cle API Google Maps manquante. Ajoutez <code className="bg-amber-500/20 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> dans votre .env.local
        </div>
      )}

      <div className="relative">
        {/* Search icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading || isSelectingDetails ? (
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
            if (predictions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled || noApiKey}
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
      {isOpen && predictions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {predictions.map((prediction, index) => {
            const { structuredFormat, text } = prediction.placePrediction;
            const mainText = structuredFormat?.mainText?.text ?? text.text;
            const secondaryText = structuredFormat?.secondaryText?.text ?? '';

            return (
              <li
                key={prediction.placePrediction.placeId}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(prediction);
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
                    {mainText}
                  </p>
                  {secondaryText && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {secondaryText}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {/* Google attribution */}
          <li className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 text-right border-t border-gray-100 dark:border-gray-700/50">
            Powered by Google
          </li>
        </ul>
      )}

      {/* Loading place details */}
      {isSelectingDetails && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Chargement des details...
        </div>
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

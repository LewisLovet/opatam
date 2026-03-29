'use client';

import { SUPPORTED_COUNTRIES } from '@booking-app/shared/constants';

const COUNTRY_FLAGS: Record<string, string> = {
  FR: '\u{1F1EB}\u{1F1F7}',
  BE: '\u{1F1E7}\u{1F1EA}',
  LU: '\u{1F1F1}\u{1F1FA}',
  CH: '\u{1F1E8}\u{1F1ED}',
  DE: '\u{1F1E9}\u{1F1EA}',
  ES: '\u{1F1EA}\u{1F1F8}',
  IT: '\u{1F1EE}\u{1F1F9}',
  NL: '\u{1F1F3}\u{1F1F1}',
  PT: '\u{1F1F5}\u{1F1F9}',
};

interface CountrySelectProps {
  value: string;
  onChange: (countryCode: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function CountrySelect({
  value,
  onChange,
  label = 'Pays',
  disabled = false,
  className = '',
}: CountrySelectProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        {SUPPORTED_COUNTRIES.map((country) => (
          <button
            key={country.code}
            type="button"
            disabled={disabled}
            onClick={() => onChange(country.code)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              ${value === country.code
                ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-white'
              }
            `}
          >
            <span className="text-base">{COUNTRY_FLAGS[country.code] ?? ''}</span>
            <span className="truncate">{country.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
